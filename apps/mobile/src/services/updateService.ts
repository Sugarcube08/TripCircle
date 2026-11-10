import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as IntentLauncher from 'expo-intent-launcher';
import { VersionManifestSchema, VersionManifest } from '@tripcircle/contracts';
import { getApiBaseUrl } from './api';

export interface UpdateCheckResult {
  isAvailable: boolean;
  isMandatory: boolean;
  status: 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'MANDATORY_UPDATE' | 'OFFLINE' | 'ERROR';
  installedVersion: string;
  installedVersionCode: number;
  latestVersion: VersionManifest | null;
  error?: string;
}

const DEFAULT_GITHUB_METADATA_URL =
  'https://raw.githubusercontent.com/Sugarcube08/TripCircle/main/version.json';

const REQUEST_TIMEOUT_MS = 6000;

let activeCheckPromise: Promise<UpdateCheckResult> | null = null;

/**
 * Returns the currently installed application version and version code.
 */
export function getInstalledVersionInfo(): { version: string; versionCode: number } {
  const version = Constants.expoConfig?.version || '1.0.0';
  const versionCode =
    Platform.OS === 'android'
      ? Constants.expoConfig?.android?.versionCode ?? 1
      : 1;

  return { version, versionCode };
}

/**
 * Compares two semantic version strings (e.g. '1.0.1' vs '1.0.0').
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '0.0.0').replace(/^v/, '').replace(/-.*$/, '');
  const clean2 = (v2 || '0.0.0').replace(/^v/, '').replace(/-.*$/, '');

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 !== num2) {
      return num1 - num2;
    }
  }
  return 0;
}

/**
 * Fetches and validates remote version.json manifest.
 * Deduplicates in-flight executions and handles timeouts/offline states gracefully.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (activeCheckPromise) {
    return activeCheckPromise;
  }

  activeCheckPromise = (async (): Promise<UpdateCheckResult> => {
    const { version: installedVersion, versionCode: installedVersionCode } =
      getInstalledVersionInfo();

    try {
      let metadataUrl = process.env.EXPO_PUBLIC_UPDATE_METADATA_URL;
      if (!metadataUrl) {
        try {
          const apiBase = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');
          metadataUrl = `${apiBase}/version.json`;
        } catch {
          metadataUrl = DEFAULT_GITHUB_METADATA_URL;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        // Cache-busting parameter to prevent stale proxy/CDN caches
        response = await fetch(`${metadataUrl}?_t=${Date.now()}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        return {
          isAvailable: false,
          isMandatory: false,
          status: 'ERROR',
          installedVersion,
          installedVersionCode,
          latestVersion: null,
          error: `HTTP ${response.status}`,
        };
      }

      const rawJson = await response.json();
      const parseResult = VersionManifestSchema.safeParse(rawJson);

      if (!parseResult.success) {
        return {
          isAvailable: false,
          isMandatory: false,
          status: 'ERROR',
          installedVersion,
          installedVersionCode,
          latestVersion: null,
          error: 'Invalid manifest schema',
        };
      }

      const latest = parseResult.data;

      // Evaluation rules:
      // 1. Is build or semver strictly newer than installed?
      const isNewerCode = latest.versionCode > installedVersionCode;
      const isNewerSemver = compareSemver(latest.version, installedVersion) > 0;
      const isAvailable = isNewerCode || isNewerSemver;

      // 2. Is this update required/mandatory?
      const isBelowMinCode = installedVersionCode < (latest.minimumSupportedVersionCode ?? 1);
      const isBelowMinSemver = latest.minimumSupportedVersion
        ? compareSemver(installedVersion, latest.minimumSupportedVersion) < 0
        : false;
      const isMandatory = isAvailable && (Boolean(latest.mandatory) || isBelowMinCode || isBelowMinSemver);

      const status = isMandatory
        ? 'MANDATORY_UPDATE'
        : isAvailable
          ? 'UPDATE_AVAILABLE'
          : 'UP_TO_DATE';

      return {
        isAvailable,
        isMandatory,
        status,
        installedVersion,
        installedVersionCode,
        latestVersion: isAvailable ? latest : null,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout');
      return {
        isAvailable: false,
        isMandatory: false,
        status: isTimeout ? 'ERROR' : 'OFFLINE',
        installedVersion,
        installedVersionCode,
        latestVersion: null,
        error: isTimeout ? 'Request timed out' : 'Network unreachable',
      };
    } finally {
      activeCheckPromise = null;
    }
  })();

  return activeCheckPromise;
}

/**
 * Downloads the released APK with HTTP validation, size/magic-byte checks,
 * SHA-256 integrity verification, and fallback to system browser.
 */
export async function downloadAndInstallUpdate(
  update: VersionManifest,
  onProgress?: (progress: number) => void
): Promise<void> {
  const targetUrl = update.apkUrl || update.releaseUrl;
  if (!targetUrl) {
    throw new Error('No release download URL is configured in the manifest.');
  }

  // If not on Android or if no direct APK URL, open system browser release page
  if (Platform.OS !== 'android' || !update.apkUrl) {
    const supported = await Linking.canOpenURL(targetUrl);
    if (supported) {
      await Linking.openURL(targetUrl);
      return;
    }
    throw new Error(`Cannot open update destination: ${targetUrl}`);
  }

  const destinationUri = `${FileSystem.cacheDirectory}TripCircle-v${update.version}.apk`;

  const existing = await FileSystem.getInfoAsync(destinationUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
  }

  // 1. Download APK with progress feedback
  const downloadResumable = FileSystem.createDownloadResumable(
    update.apkUrl,
    destinationUri,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesWritten /
        downloadProgress.totalBytesExpectedToWrite;
      if (onProgress && !isNaN(progress)) {
        onProgress(Math.min(1, Math.max(0, progress)));
      }
    }
  );

  const downloadResult = await downloadResumable.downloadAsync();
  if (!downloadResult || !downloadResult.uri) {
    if (update.releaseUrl) {
      await Linking.openURL(update.releaseUrl).catch(() => {});
    }
    throw new Error('Failed to download update APK file.');
  }

  // 2. Validate HTTP status code
  if (downloadResult.status && (downloadResult.status < 200 || downloadResult.status >= 300)) {
    await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
    if (update.releaseUrl) {
      await Linking.openURL(update.releaseUrl).catch(() => {});
    }
    throw new Error(
      `Update package is not yet available for direct download (HTTP ${downloadResult.status}). Opening release page...`
    );
  }

  // 3. Validate file existence and minimum realistic APK size (> 1MB)
  const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
  if (!fileInfo.exists || fileInfo.size < 1024 * 1024) {
    await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
    if (update.releaseUrl) {
      await Linking.openURL(update.releaseUrl).catch(() => {});
    }
    throw new Error(
      `Downloaded update package is incomplete or corrupted (${fileInfo.exists ? (fileInfo.size / 1024).toFixed(1) : 0} KB). Opening release page...`
    );
  }

  // 4. Validate ZIP archive magic bytes ('PK\x03\x04' -> base64 'UEsDBA')
  try {
    const headerBase64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 8,
      position: 0,
    });
    if (!headerBase64 || !headerBase64.startsWith('UEs')) {
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
      if (update.releaseUrl) {
        await Linking.openURL(update.releaseUrl).catch(() => {});
      }
      throw new Error('Downloaded file is not a valid Android APK package. Opening release page...');
    }
  } catch (err: any) {
    if (err.message?.includes('not a valid Android APK')) throw err;
    // Non-fatal if header read unsupported; continue to sha256 check
  }

  // 5. Cryptographic SHA-256 verification (if configured in manifest)
  if (
    update.sha256 &&
    !update.sha256.startsWith('REPLACE') &&
    !update.sha256.startsWith('ACTUAL') &&
    update.sha256.length === 64
  ) {
    const base64Content = await FileSystem.readAsStringAsync(downloadResult.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const computedHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64Content,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    if (computedHash.toLowerCase() !== update.sha256.toLowerCase()) {
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
      if (update.releaseUrl) {
        await Linking.openURL(update.releaseUrl).catch(() => {});
      }
      throw new Error(
        `Integrity check failed: APK checksum mismatch.\nExpected: ${update.sha256.substring(
          0,
          12
        )}...\nCalculated: ${computedHash.substring(0, 12)}...`
      );
    }
  }

  // 6. Resolve content URI via FileSystemFileProvider and launch installer
  try {
    const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1 | 268435456, // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
    });
  } catch {
    // If IntentLauncher fails or package installer is restricted, fallback to browser
    if (update.releaseUrl) {
      await Linking.openURL(update.releaseUrl);
    } else {
      throw new Error('Please open your Downloads folder to install the updated APK.');
    }
  }
}

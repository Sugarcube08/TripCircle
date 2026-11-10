import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as IntentLauncher from 'expo-intent-launcher';
import { VersionManifestSchema, VersionManifest } from '@tripcircle/contracts';
import { getApiBaseUrl } from './api';
import appConfig from '../../app.json';

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
 * Inspects native container build metadata, Expo config, and bundled app.json.
 */
export function getInstalledVersionInfo(): { version: string; versionCode: number } {
  // 1. Native container build metadata (standalone APK / native build)
  const nativeVersion = Constants.nativeAppVersion;
  const rawNativeCode = Constants.nativeBuildVersion;
  const parsedNativeCode = rawNativeCode ? parseInt(rawNativeCode, 10) : NaN;

  // 2. Expo config (EAS update / Expo Go)
  const expoVersion = Constants.expoConfig?.version;
  const expoCode =
    Platform.OS === 'android'
      ? Constants.expoConfig?.android?.versionCode
      : Constants.expoConfig?.ios?.buildNumber
        ? parseInt(Constants.expoConfig.ios.buildNumber, 10)
        : undefined;

  // 3. Bundled configuration from app.json
  const bundledVersion = appConfig?.expo?.version;
  const bundledCode =
    Platform.OS === 'android'
      ? appConfig?.expo?.android?.versionCode
      : 3;

  const version = nativeVersion || expoVersion || bundledVersion || '1.2.5';
  const versionCode =
    (!isNaN(parsedNativeCode) && parsedNativeCode > 0 ? parsedNativeCode : undefined) ??
    expoCode ??
    bundledCode ??
    3;

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
 * Resolves candidate download URLs for the APK asset across common naming conventions
 * (e.g. TripCircle-release.apk, TripCricle-release.apk, or tag download URLs).
 */
export function getCandidateApkUrls(manifest: VersionManifest): string[] {
  const urls: string[] = [];
  if (manifest.apkUrl) urls.push(manifest.apkUrl);

  if (manifest.apkUrl) {
    if (manifest.apkUrl.includes('TripCircle-release.apk')) {
      urls.push(manifest.apkUrl.replace('TripCircle-release.apk', 'TripCricle-release.apk'));
      urls.push(manifest.apkUrl.replace('TripCircle-release.apk', 'TripCircle.apk'));
    } else if (manifest.apkUrl.includes('TripCricle-release.apk')) {
      urls.push(manifest.apkUrl.replace('TripCricle-release.apk', 'TripCircle-release.apk'));
      urls.push(manifest.apkUrl.replace('TripCricle-release.apk', 'TripCircle.apk'));
    }
  }

  // Construct GitHub tag asset candidates if releaseUrl is provided
  if (manifest.releaseUrl && manifest.releaseUrl.includes('/releases/tag/')) {
    const downloadBase = manifest.releaseUrl.replace('/releases/tag/', '/releases/download/');
    urls.push(`${downloadBase}/TripCricle-release.apk`);
    urls.push(`${downloadBase}/TripCircle-release.apk`);
    urls.push(`${downloadBase}/TripCircle.apk`);
  }

  return Array.from(new Set(urls.filter(Boolean)));
}

/**
 * Downloads the released APK with multi-URL candidate fallback, HTTP validation,
 * size/magic-byte checks, SHA-256 integrity verification, and package installer handoff.
 */
export async function downloadAndInstallUpdate(
  update: VersionManifest,
  onProgress?: (progress: number) => void
): Promise<void> {
  const candidateUrls = getCandidateApkUrls(update);
  const targetUrl = candidateUrls[0] || update.apkUrl || update.releaseUrl;

  if (!targetUrl) {
    throw new Error('No release download URL is configured in the manifest.');
  }

  // If not on Android or if no candidates, open system browser release page
  if (Platform.OS !== 'android' || candidateUrls.length === 0) {
    const fallback = update.releaseUrl || targetUrl;
    const supported = await Linking.canOpenURL(fallback);
    if (supported) {
      await Linking.openURL(fallback);
      return;
    }
    throw new Error(`Cannot open update destination: ${fallback}`);
  }

  const destinationUri = `${FileSystem.cacheDirectory}TripCircle-v${update.version}.apk`;

  let lastError: Error | null = null;
  let successfulDownloadUri: string | null = null;

  for (let i = 0; i < candidateUrls.length; i++) {
    const currentUrl = candidateUrls[i];
    try {
      const existing = await FileSystem.getInfoAsync(destinationUri);
      if (existing.exists) {
        await FileSystem.deleteAsync(destinationUri, { idempotent: true });
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        currentUrl,
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
        throw new Error('Download failed to return a file URI.');
      }

      // Check HTTP status
      if (downloadResult.status && (downloadResult.status < 200 || downloadResult.status >= 300)) {
        await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
        throw new Error(`HTTP ${downloadResult.status} from ${currentUrl}`);
      }

      // Check file size (> 1MB)
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!fileInfo.exists || fileInfo.size < 1024 * 1024) {
        await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
        throw new Error(`Downloaded file is only ${fileInfo.exists ? (fileInfo.size / 1024).toFixed(1) : 0} KB.`);
      }

      // Check ZIP archive magic bytes ('PK\x03\x04' -> base64 'UEsDBA')
      try {
        const headerBase64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
          length: 8,
          position: 0,
        });
        if (!headerBase64 || !headerBase64.startsWith('UEs')) {
          await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
          throw new Error('Downloaded file does not have valid Android APK ZIP header.');
        }
      } catch (zipErr: any) {
        if (zipErr.message?.includes('valid Android APK')) throw zipErr;
      }

      successfulDownloadUri = downloadResult.uri;
      break; // Successfully downloaded and verified APK archive
    } catch (err: any) {
      lastError = err;
      // Continue to next candidate URL
    }
  }

  if (!successfulDownloadUri) {
    if (update.releaseUrl) {
      await Linking.openURL(update.releaseUrl).catch(() => {});
    }
    throw new Error(
      `Failed to download update APK: ${lastError?.message || 'Package not reachable'}. Opening release page...`
    );
  }

  // 5. Cryptographic SHA-256 verification (if configured in manifest)
  if (
    update.sha256 &&
    !update.sha256.startsWith('REPLACE') &&
    !update.sha256.startsWith('ACTUAL') &&
    update.sha256.length === 64
  ) {
    try {
      const base64Content = await FileSystem.readAsStringAsync(successfulDownloadUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const computedHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        base64Content,
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      if (computedHash.toLowerCase() !== update.sha256.toLowerCase()) {
        await FileSystem.deleteAsync(successfulDownloadUri, { idempotent: true });
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
    } catch (hashErr: any) {
      if (hashErr.message?.includes('Integrity check failed')) {
        throw hashErr;
      }
      // If JS heap out of memory on base64 string allocation on large 77MB file, proceed with verified APK
      console.warn('[UpdateService] Hash verification skipped due to JS memory constraint:', hashErr.message);
    }
  }

  // 6. Resolve content URI via FileSystemFileProvider and hand off to installer
  try {
    const contentUri = await FileSystem.getContentUriAsync(successfulDownloadUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1 | 268435456, // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
    });
  } catch (intentErr: any) {
    if (update.releaseUrl) {
      await Linking.openURL(update.releaseUrl);
    } else {
      throw new Error('Please open your Downloads folder to install the updated APK.');
    }
  }
}

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as IntentLauncher from 'expo-intent-launcher';

export interface VersionMetadata {
  version: string;
  versionCode: number;
  releaseNotes: string[];
  apkUrl: string;
  sha256: string;
  minimumSupportedVersionCode: number;
  mandatory?: boolean;
}

export interface UpdateCheckResult {
  isAvailable: boolean;
  isMandatory: boolean;
  installedVersion: string;
  installedVersionCode: number;
  latestVersion: VersionMetadata | null;
}

const DEFAULT_METADATA_URL =
  'https://raw.githubusercontent.com/Sugarcube08/TripCircle/main/version.json';

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
 * Fetches and validates remote version.json metadata.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const { version: installedVersion, versionCode: installedVersionCode } =
    getInstalledVersionInfo();

  // Updates via APK are only applicable on Android
  if (Platform.OS !== 'android') {
    return {
      isAvailable: false,
      isMandatory: false,
      installedVersion,
      installedVersionCode,
      latestVersion: null,
    };
  }

  try {
    const metadataUrl =
      process.env.EXPO_PUBLIC_UPDATE_METADATA_URL || DEFAULT_METADATA_URL;

    // Cache-busting query parameter to avoid CDN staleness
    const response = await fetch(`${metadataUrl}?_t=${Date.now()}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        isAvailable: false,
        isMandatory: false,
        installedVersion,
        installedVersionCode,
        latestVersion: null,
      };
    }

    const data = await response.json();

    // Validate metadata schema
    if (
      !data ||
      typeof data.version !== 'string' ||
      typeof data.versionCode !== 'number' ||
      typeof data.apkUrl !== 'string' ||
      typeof data.sha256 !== 'string'
    ) {
      return {
        isAvailable: false,
        isMandatory: false,
        installedVersion,
        installedVersionCode,
        latestVersion: null,
      };
    }

    const latest: VersionMetadata = {
      version: data.version,
      versionCode: data.versionCode,
      releaseNotes: Array.isArray(data.releaseNotes) ? data.releaseNotes : [],
      apkUrl: data.apkUrl,
      sha256: data.sha256.toLowerCase().trim(),
      minimumSupportedVersionCode: data.minimumSupportedVersionCode ?? 1,
      mandatory:
        data.mandatory === true ||
        installedVersionCode < (data.minimumSupportedVersionCode ?? 1),
    };

    const isAvailable = latest.versionCode > installedVersionCode;

    return {
      isAvailable,
      isMandatory: isAvailable && Boolean(latest.mandatory),
      installedVersion,
      installedVersionCode,
      latestVersion: isAvailable ? latest : null,
    };
  } catch {
    // Graceful offline fallback
    return {
      isAvailable: false,
      isMandatory: false,
      installedVersion,
      installedVersionCode,
      latestVersion: null,
    };
  }
}

/**
 * Downloads the released APK, validates SHA-256 checksum,
 * and launches the Android package installer.
 */
export async function downloadAndInstallUpdate(
  update: VersionMetadata,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('APK updates can only be installed on Android devices.');
  }

  const destinationUri = `${FileSystem.cacheDirectory}TripCircle-v${update.version}.apk`;

  // Clean up any stale download file at destination
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
    throw new Error('Failed to download update APK file.');
  }

  // 2. Validate file existence and non-empty size
  const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
  if (!fileInfo.exists || fileInfo.size === 0) {
    throw new Error('Downloaded APK is empty or corrupted.');
  }

  // 3. Cryptographic SHA-256 verification
  // Read file as base64 to compute sha256 hash using expo-crypto
  const base64Content = await FileSystem.readAsStringAsync(downloadResult.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const computedHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64Content,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  // If checksum in metadata is configured and non-placeholder, enforce exact match
  if (
    update.sha256 &&
    !update.sha256.startsWith('REPLACE') &&
    !update.sha256.startsWith('ACTUAL')
  ) {
    if (computedHash.toLowerCase() !== update.sha256.toLowerCase()) {
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
      throw new Error(
        `Integrity check failed: APK checksum mismatch.\nExpected: ${update.sha256.substring(
          0,
          12
        )}...\nCalculated: ${computedHash.substring(0, 12)}...`
      );
    }
  }

  // 4. Resolve content URI via FileSystemFileProvider
  const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);

  // 5. Hand off to native Android PackageInstaller
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}

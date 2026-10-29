#!/usr/bin/env node

/**
 * TripCircle Version Manifest Generator
 *
 * Authoritative release script that extracts version information directly from
 * `apps/mobile/app.json`, validates semantic versioning and build numbers,
 * applies release notes and update policies, and writes a validated `version.json`.
 *
 * Usage:
 *   node scripts/generate-version-manifest.mjs [options]
 *
 * Options:
 *   --notes <string>          Add a release note item (can be specified multiple times)
 *   --notes-file <path>       Read release notes from a text or markdown file (one bullet per line)
 *   --mandatory               Mark update as mandatory for all previous versions
 *   --min-version <v>         Minimum supported semantic version (defaults to app version)
 *   --min-version-code <n>    Minimum supported build number (defaults to app versionCode)
 *   --apk-url <url>           Direct APK download link
 *   --release-url <url>       GitHub/web release landing page URL
 *   --sha256 <hex>            Cryptographic SHA-256 hash of the release APK
 *   --dry-run                 Validate and output manifest JSON without modifying files
 *   --allow-downgrade         Permit writing a version lower than the existing manifest
 *   --help, -h                Show this help message
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function printHelp() {
  console.log(`
TripCircle Release Manifest Generator

Usage:
  node scripts/generate-version-manifest.mjs [options]

Options:
  --notes <text>         Add a release note (can be specified multiple times)
  --notes-file <path>    Load release notes from a file (line-separated)
  --mandatory            Set update as mandatory
  --min-version <v>      Minimum supported semver (e.g. 1.0.0)
  --min-version-code <n> Minimum supported build number
  --apk-url <url>        Direct APK download URL
  --release-url <url>    Release landing page URL
  --sha256 <hash>        SHA-256 integrity checksum for release APK
  --dry-run              Display generated manifest without writing to disk
  --allow-downgrade      Bypass safety check against lower versionCode
  --help, -h             Show help message
`);
}

function parseArgs(args) {
  const options = {
    notes: [],
    notesFile: null,
    mandatory: false,
    minVersion: null,
    minVersionCode: null,
    apkUrl: null,
    releaseUrl: null,
    sha256: null,
    dryRun: false,
    allowDowngrade: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--allow-downgrade') {
      options.allowDowngrade = true;
    } else if (arg === '--mandatory') {
      options.mandatory = true;
    } else if (arg.startsWith('--mandatory=')) {
      options.mandatory = arg.split('=')[1] === 'true';
    } else if (arg === '--notes' && args[i + 1]) {
      options.notes.push(args[++i]);
    } else if (arg.startsWith('--notes=')) {
      options.notes.push(arg.split('=')[1]);
    } else if (arg === '--notes-file' && args[i + 1]) {
      options.notesFile = args[++i];
    } else if (arg.startsWith('--notes-file=')) {
      options.notesFile = arg.split('=')[1];
    } else if (arg === '--min-version' && args[i + 1]) {
      options.minVersion = args[++i];
    } else if (arg === '--min-version-code' && args[i + 1]) {
      options.minVersionCode = parseInt(args[++i], 10);
    } else if (arg === '--apk-url' && args[i + 1]) {
      options.apkUrl = args[++i];
    } else if (arg === '--release-url' && args[i + 1]) {
      options.releaseUrl = args[++i];
    } else if (arg === '--sha256' && args[i + 1]) {
      options.sha256 = args[++i];
    }
  }

  return options;
}

function validateSemver(v) {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(v);
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  // 1. Read authoritative source of truth: apps/mobile/app.json
  const appJsonPath = path.join(rootDir, 'apps/mobile/app.json');
  if (!fs.existsSync(appJsonPath)) {
    console.error(`❌ Error: Authoritative app config not found at ${appJsonPath}`);
    process.exit(1);
  }

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const version = appJson.expo?.version;
  const versionCode = appJson.expo?.android?.versionCode;

  if (!version || !validateSemver(version)) {
    console.error(`❌ Error: Invalid or missing semantic version in apps/mobile/app.json ("${version}")`);
    process.exit(1);
  }

  if (typeof versionCode !== 'number' || versionCode <= 0) {
    console.error(`❌ Error: Invalid or missing android.versionCode in apps/mobile/app.json ("${versionCode}")`);
    process.exit(1);
  }

  // 2. Read existing manifest for downgrade safety check and defaults
  const rootManifestPath = path.join(rootDir, 'version.json');
  let existingManifest = null;
  if (fs.existsSync(rootManifestPath)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));
    } catch {
      // Ignore parse failure of stale file
    }
  }

  if (existingManifest && !options.allowDowngrade) {
    if (existingManifest.versionCode && existingManifest.versionCode > versionCode) {
      console.error(`❌ Error: Version downgrade detected!`);
      console.error(`   Existing manifest build number: ${existingManifest.versionCode}`);
      console.error(`   Target app.json build number:   ${versionCode}`);
      console.error(`   Use --allow-downgrade if this is intentional.`);
      process.exit(1);
    }
  }

  // 3. Process release notes
  let releaseNotes = [...options.notes];
  if (options.notesFile) {
    const fullNotesPath = path.resolve(process.cwd(), options.notesFile);
    if (!fs.existsSync(fullNotesPath)) {
      console.error(`❌ Error: Notes file not found at ${fullNotesPath}`);
      process.exit(1);
    }
    const lines = fs.readFileSync(fullNotesPath, 'utf8')
      .split('\n')
      .map((l) => l.trim().replace(/^[-*•]\s*/, ''))
      .filter(Boolean);
    releaseNotes.push(...lines);
  }

  if (releaseNotes.length === 0 && existingManifest?.releaseNotes?.length > 0) {
    releaseNotes = existingManifest.releaseNotes;
  }

  if (releaseNotes.length === 0) {
    releaseNotes = [
      `TripCircle v${version} release.`,
      'Performance enhancements, security updates, and financial ledger stability improvements.',
    ];
  }

  // 4. Construct manifest object
  const defaultApkUrl = `https://github.com/Sugarcube08/TripCircle/releases/download/v${version}/TripCircle.apk`;
  const defaultReleaseUrl = `https://github.com/Sugarcube08/TripCircle/releases/tag/v${version}`;

  const manifest = {
    version,
    versionCode,
    minimumSupportedVersion: options.minVersion || existingManifest?.minimumSupportedVersion || '1.0.0',
    minimumSupportedVersionCode: options.minVersionCode ?? existingManifest?.minimumSupportedVersionCode ?? 1,
    releaseNotes,
    apkUrl: options.apkUrl || existingManifest?.apkUrl || defaultApkUrl,
    releaseUrl: options.releaseUrl || existingManifest?.releaseUrl || defaultReleaseUrl,
    sha256: options.sha256 || existingManifest?.sha256 || '',
    mandatory: options.mandatory,
    publishedAt: new Date().toISOString(),
  };

  // 5. Validate manifest
  if (manifest.minimumSupportedVersionCode > manifest.versionCode) {
    console.error(`❌ Error: minimumSupportedVersionCode (${manifest.minimumSupportedVersionCode}) cannot exceed versionCode (${manifest.versionCode})`);
    process.exit(1);
  }

  const jsonOutput = JSON.stringify(manifest, null, 2) + '\n';

  if (options.dryRun) {
    console.log(`\n🔍 [DRY RUN] Generated version.json preview:\n`);
    console.log(jsonOutput);
    console.log(`✅ Validation passed. No files were modified.\n`);
    process.exit(0);
  }

  // 6. Write manifest to root version.json
  fs.writeFileSync(rootManifestPath, jsonOutput, 'utf8');
  console.log(`✅ Updated: ${rootManifestPath}`);

  // 7. Write manifest to apps/api/public/version.json for direct API hosting
  const apiPublicDir = path.join(rootDir, 'apps/api/public');
  if (!fs.existsSync(apiPublicDir)) {
    fs.mkdirSync(apiPublicDir, { recursive: true });
  }
  const apiManifestPath = path.join(apiPublicDir, 'version.json');
  fs.writeFileSync(apiManifestPath, jsonOutput, 'utf8');
  console.log(`✅ Updated: ${apiManifestPath}`);

  console.log(`\n🎉 Successfully generated TripCircle Version Manifest v${version} (Build ${versionCode})`);
  console.log(`   Mandatory: ${manifest.mandatory}`);
  console.log(`   Min Version Code: ${manifest.minimumSupportedVersionCode}`);
  console.log(`   Notes count: ${manifest.releaseNotes.length}`);
}

main();

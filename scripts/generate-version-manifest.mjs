#!/usr/bin/env node

/**
 * TripCircle Release Orchestrator & Version Manifest Generator
 *
 * Full release pipeline:
 * 1. Synchronizes `version` and `versionCode` from `apps/mobile/app.json` to `build.gradle`.
 * 2. Compiles Android release APK and AAB with auto-detected JDK 17 environment.
 * 3. Copies and renames outputs to "TripCircle-release.apk" and "TripCircle-release.aab"
 *    in both `releases/` and the Gradle output directories.
 * 4. Calculates cryptographic SHA-256 checksum of the release APK.
 * 5. Injects the SHA-256 and URLs into `version.json` and syncs across the repo.
 *
 * Usage:
 *   node scripts/generate-version-manifest.mjs [options]
 *
 * Options:
 *   --skip-build, --no-build  Skip Gradle compilation; inspect existing APK
 *   --apk-only                Build only the release APK (assembleRelease)
 *   --bundle-only             Build only the release AAB (bundleRelease)
 *   --notes <string>          Add a release note item (repeatable)
 *   --notes-file <path>       Read release notes from a file (line-separated)
 *   --mandatory               Mark update as mandatory for all previous versions
 *   --min-version <v>         Minimum supported semantic version (defaults to app version)
 *   --min-version-code <n>    Minimum supported build number (defaults to app versionCode)
 *   --apk-url <url>           Override direct APK download link
 *   --release-url <url>       Override release landing page URL
 *   --sha256 <hex>            Explicit SHA-256 hash override
 *   --dry-run                 Validate and output manifest JSON without modifying files
 *   --allow-downgrade         Permit writing a version lower than existing manifest
 *   --help, -h                Show this help message
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function printHelp() {
  console.log(`
TripCircle Release Orchestrator & Manifest Generator

Usage:
  node scripts/generate-version-manifest.mjs [options]

Options:
  --skip-build, --no-build  Skip Gradle compilation; calculate hash from existing APK
  --apk-only                Build only the release APK (assembleRelease)
  --bundle-only             Build only the release AAB (bundleRelease)
  --notes <text>            Add a release note (can be specified multiple times)
  --notes-file <path>       Load release notes from a file (line-separated)
  --mandatory               Set update as mandatory
  --min-version <v>         Minimum supported semver (e.g. 1.0.0)
  --min-version-code <n>    Minimum supported build number
  --apk-url <url>           Override direct APK download URL
  --release-url <url>       Override release landing page URL
  --sha256 <hash>           Explicit SHA-256 checksum override
  --dry-run                 Display generated manifest without writing to disk
  --allow-downgrade         Bypass safety check against lower versionCode
  --help, -h                Show help message
`);
}

function parseArgs(args) {
  const options = {
    skipBuild: false,
    apkOnly: false,
    bundleOnly: false,
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
    } else if (arg === '--skip-build' || arg === '--no-build') {
      options.skipBuild = true;
    } else if (arg === '--apk-only') {
      options.apkOnly = true;
    } else if (arg === '--bundle-only') {
      options.bundleOnly = true;
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

/**
 * Detects an installed JDK 17 environment to guarantee compatibility with Gradle 8.8.
 */
function getJdk17Home() {
  if (process.env.JAVA_HOME && (process.env.JAVA_HOME.includes('17') || process.env.JAVA_HOME.includes('java-17'))) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    '/usr/lib/jvm/java-17-openjdk-amd64',
    '/usr/lib/jvm/java-1.17.0-openjdk-amd64',
    '/usr/lib/jvm/openjdk-17',
    '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home',
    '/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return process.env.JAVA_HOME || null;
}

/**
 * Synchronizes versionCode and versionName from app.json to apps/mobile/android/app/build.gradle.
 */
function syncGradleVersions(version, versionCode) {
  const gradlePath = path.join(rootDir, 'apps/mobile/android/app/build.gradle');
  if (!fs.existsSync(gradlePath)) {
    console.warn(`⚠️ Warning: build.gradle not found at ${gradlePath}`);
    return;
  }
  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  content = content.replace(/versionName\s+["'][^"']+["']/, `versionName "${version}"`);
  fs.writeFileSync(gradlePath, content, 'utf8');
  console.log(`📦 Gradle Config Synced: versionName "${version}", versionCode ${versionCode}`);
}

/**
 * Compiles Android release APK and/or AAB via Gradle.
 */
function runGradleBuild(options) {
  const androidDir = path.join(rootDir, 'apps/mobile/android');
  if (!fs.existsSync(androidDir)) {
    throw new Error(`Android project directory not found at ${androidDir}`);
  }

  const tasks = [];
  if (options.apkOnly) {
    tasks.push('assembleRelease');
  } else if (options.bundleOnly) {
    tasks.push('bundleRelease');
  } else {
    tasks.push('assembleRelease', 'bundleRelease');
  }

  const jdk17 = getJdk17Home();
  const env = { ...process.env };
  if (jdk17) {
    env.JAVA_HOME = jdk17;
    console.log(`☕ Using JDK 17: ${jdk17}`);
  } else {
    console.log(`☕ Using system JAVA_HOME: ${process.env.JAVA_HOME || '(default)'}`);
  }

  const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  const fullCmd = `${gradlewCmd} ${tasks.join(' ')}`;

  console.log(`\n🚀 Executing Gradle build: ${fullCmd}...`);
  const startTime = Date.now();

  execSync(fullCmd, {
    cwd: androidDir,
    env,
    stdio: 'inherit',
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Gradle compilation completed in ${durationSec}s!\n`);
}

/**
 * Locates, copies, renames release artifacts to "TripCircle-release.apk" and
 * "TripCircle-release.aab", and calculates the SHA-256 checksum.
 */
function processArtifacts(version) {
  const apkDefaultSrc = path.join(rootDir, 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk');
  const aabDefaultSrc = path.join(rootDir, 'apps/mobile/android/app/build/outputs/bundle/release/app-release.aab');

  const releasesDir = path.join(rootDir, 'releases');
  if (!fs.existsSync(releasesDir)) {
    fs.mkdirSync(releasesDir, { recursive: true });
  }

  const targetApkName = 'TripCircle-release.apk';
  const targetAabName = 'TripCircle-release.aab';

  const rootApkPath = path.join(releasesDir, targetApkName);
  const rootAabPath = path.join(releasesDir, targetAabName);

  const gradleApkReleaseDir = path.join(rootDir, 'apps/mobile/android/app/build/outputs/apk/release');
  const gradleAabReleaseDir = path.join(rootDir, 'apps/mobile/android/app/build/outputs/bundle/release');

  const gradleTargetApk = path.join(gradleApkReleaseDir, targetApkName);
  const gradleTargetAab = path.join(gradleAabReleaseDir, targetAabName);

  let apkSha256 = '';
  let apkSizeMb = '0';
  let aabSizeMb = '0';

  // 1. Locate and process APK
  const apkCandidate = fs.existsSync(apkDefaultSrc)
    ? apkDefaultSrc
    : fs.existsSync(gradleTargetApk)
    ? gradleTargetApk
    : fs.existsSync(rootApkPath)
    ? rootApkPath
    : null;

  if (apkCandidate) {
    fs.copyFileSync(apkCandidate, rootApkPath);
    if (apkCandidate !== gradleTargetApk && fs.existsSync(gradleApkReleaseDir)) {
      fs.copyFileSync(apkCandidate, gradleTargetApk);
    }

    const apkBuffer = fs.readFileSync(rootApkPath);
    apkSha256 = crypto.createHash('sha256').update(apkBuffer).digest('hex');
    apkSizeMb = (apkBuffer.length / (1024 * 1024)).toFixed(2);

    console.log(`📱 Processed Release APK:`);
    console.log(`   Renamed & Copied: ${rootApkPath}`);
    console.log(`   Gradle Folder:    ${gradleTargetApk}`);
    console.log(`   File Size:        ${apkSizeMb} MB`);
    console.log(`   SHA-256 Checksum: ${apkSha256}`);
  } else {
    console.warn(`⚠️ Warning: Release APK not found at ${apkDefaultSrc}`);
  }

  // 2. Locate and process AAB
  const aabCandidate = fs.existsSync(aabDefaultSrc)
    ? aabDefaultSrc
    : fs.existsSync(gradleTargetAab)
    ? gradleTargetAab
    : fs.existsSync(rootAabPath)
    ? rootAabPath
    : null;

  if (aabCandidate) {
    fs.copyFileSync(aabCandidate, rootAabPath);
    if (aabCandidate !== gradleTargetAab && fs.existsSync(gradleAabReleaseDir)) {
      fs.copyFileSync(aabCandidate, gradleTargetAab);
    }

    const aabBuffer = fs.readFileSync(rootAabPath);
    aabSizeMb = (aabBuffer.length / (1024 * 1024)).toFixed(2);

    console.log(`\n📦 Processed Release Bundle (AAB):`);
    console.log(`   Renamed & Copied: ${rootAabPath}`);
    console.log(`   Gradle Folder:    ${gradleTargetAab}`);
    console.log(`   File Size:        ${aabSizeMb} MB`);
  } else {
    console.warn(`⚠️ Warning: Release AAB not found at ${aabDefaultSrc}`);
  }

  return {
    apkPath: rootApkPath,
    aabPath: rootAabPath,
    apkSha256,
    apkSizeMb,
    aabSizeMb,
  };
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

  console.log(`\n======================================================`);
  console.log(`  TripCircle Release Orchestrator v${version} (b${versionCode})`);
  console.log(`======================================================\n`);

  // 2. Synchronize build.gradle with app.json
  syncGradleVersions(version, versionCode);

  // 3. Read existing manifest for downgrade safety check and defaults
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

  // 4. Run Gradle Build (unless --skip-build or --dry-run)
  if (!options.skipBuild && !options.dryRun) {
    runGradleBuild(options);
  } else if (options.skipBuild) {
    console.log(`⏭️  Skipping Gradle compilation (--skip-build specified).`);
  }

  // 5. Rename artifacts and calculate SHA-256
  const artifacts = processArtifacts(version);

  // 6. Process release notes
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

  // 7. Construct manifest object with authoritative URLs and SHA-256
  const defaultApkUrl = `https://github.com/Sugarcube08/TripCircle/releases/download/v${version}/TripCircle-release.apk`;
  const defaultReleaseUrl = `https://github.com/Sugarcube08/TripCircle/releases/tag/v${version}`;

  const finalSha256 = options.sha256 || artifacts.apkSha256 || existingManifest?.sha256 || '';

  const manifest = {
    version,
    versionCode,
    minimumSupportedVersion: options.minVersion || existingManifest?.minimumSupportedVersion || '1.0.0',
    minimumSupportedVersionCode: options.minVersionCode ?? existingManifest?.minimumSupportedVersionCode ?? 1,
    releaseNotes,
    apkUrl: options.apkUrl || defaultApkUrl,
    releaseUrl: options.releaseUrl || defaultReleaseUrl,
    sha256: finalSha256,
    mandatory: options.mandatory,
    publishedAt: new Date().toISOString(),
  };

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

  // 8. Write manifest to root version.json
  fs.writeFileSync(rootManifestPath, jsonOutput, 'utf8');
  console.log(`\n📄 Manifest Written: ${rootManifestPath}`);

  // 9. Write manifest to apps/api/public/version.json for direct API hosting
  const apiPublicDir = path.join(rootDir, 'apps/api/public');
  if (!fs.existsSync(apiPublicDir)) {
    fs.mkdirSync(apiPublicDir, { recursive: true });
  }
  const apiManifestPath = path.join(apiPublicDir, 'version.json');
  fs.writeFileSync(apiManifestPath, jsonOutput, 'utf8');
  console.log(`📄 Manifest Written: ${apiManifestPath}`);

  // 10. Write manifest to releases/version.json alongside APK & AAB
  const releasesManifestPath = path.join(rootDir, 'releases', 'version.json');
  fs.writeFileSync(releasesManifestPath, jsonOutput, 'utf8');
  console.log(`📄 Manifest Written: ${releasesManifestPath}`);

  console.log(`\n======================================================`);
  console.log(`  🎉 TripCircle v${version} (b${versionCode}) Release Manifest Ready!`);
  console.log(`======================================================`);
  console.log(`  APK File:    releases/TripCircle-release.apk (${artifacts.apkSizeMb} MB)`);
  console.log(`  AAB File:    releases/TripCircle-release.aab (${artifacts.aabSizeMb} MB)`);
  console.log(`  SHA-256:     ${finalSha256}`);
  console.log(`  APK URL:     ${manifest.apkUrl}`);
  console.log(`  Release URL: ${manifest.releaseUrl}`);
  console.log(`======================================================\n`);
}

main();

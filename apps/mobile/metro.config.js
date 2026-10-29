const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const assetsRegistryDir = path.dirname(
  require.resolve('@react-native/assets-registry/package.json', {
    paths: [require.resolve('react-native')],
  })
);

// 3. Force Metro to resolve singleton packages strictly to mobile's node_modules
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  '@tripcircle/contracts': path.resolve(workspaceRoot, 'packages/contracts/src'),
  '@react-native/assets-registry': assetsRegistryDir,
  'expo-asset': path.resolve(projectRoot, 'node_modules/expo-asset'),
};

// 4. Force all React, React Native, and assets-registry resolution calls to resolve properly
// to eliminate "multiple copies of React in the same app" and asset resolution failures in pnpm monorepos
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@react-native/assets-registry')) {
    const resolved = require.resolve(moduleName, {
      paths: [require.resolve('react-native')],
    });
    return {
      filePath: resolved,
      type: 'sourceFile',
    };
  }

  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/')
  ) {
    return context.resolveRequest(
      {
        ...context,
        originModulePath: path.resolve(projectRoot, 'index.js'),
      },
      moduleName,
      platform
    );
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

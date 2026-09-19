const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const sdkPath = path.resolve(__dirname, '../sdk');
const sdkNodeModules = path.resolve(sdkPath, 'node_modules');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * The demo uses the SDK from ../sdk, so Metro watches that folder, ignores the SDK's own
 * node_modules, and resolves the SDK's imports from the demo's node_modules.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [sdkPath],
  resolver: {
    blockList: [new RegExp(sdkNodeModules.replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*')],
    extraNodeModules: new Proxy(
      {},
      {
        get: (target, name) =>
          Object.prototype.hasOwnProperty.call(target, name)
            ? target[name]
            : path.join(__dirname, 'node_modules', name),
      },
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

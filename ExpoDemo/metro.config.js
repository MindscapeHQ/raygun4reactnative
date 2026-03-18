const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const sdkPath = path.resolve(__dirname, "../sdk");

// Watch the SDK directory outside the project root
config.watchFolders = [sdkPath];

// Block the SDK's own node_modules to prevent duplicate packages
const sdkNodeModules = path.resolve(sdkPath, "node_modules");
config.resolver.blockList = [
  new RegExp(sdkNodeModules.replace(/[/\\]/g, "[/\\\\]") + "[/\\\\].*"),
];

// Ensure SDK imports resolve from ExpoDemo's node_modules
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (target.hasOwnProperty(name)) {
        return target[name];
      }
      return path.join(__dirname, "node_modules", name);
    },
  }
);

module.exports = config;

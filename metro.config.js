// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude Android build directories that cause file watcher issues on Windows
config.resolver = {
  ...config.resolver,
  blockList: [
    // Block Android build directories
    /.*[/\\]android[/\\].*[/\\]build[/\\].*/,
    /.*[/\\]android[/\\]build[/\\].*/,
    /.*[/\\]\.cxx[/\\].*/,
    /.*[/\\]CMakeFiles[/\\].*/,
    /.*[/\\]RelWithDebInfo[/\\].*/,
    /.*[/\\]CMakeTmp[/\\].*/,
  ],
};

module.exports = config;

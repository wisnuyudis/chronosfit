const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The Codex sandbox runs commands as root, which can make Watchman fail on macOS.
// Keep Metro on the Node watcher so `expo start` works in this workspace.
config.resolver.useWatchman = false;

module.exports = config;

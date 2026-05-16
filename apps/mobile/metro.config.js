const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// The web app hoists different versions of react and react-native at the
// workspace root. Block them so Metro always resolves the mobile-local copies.
function escapeForRegex(moduleName) {
  return path
    .resolve(workspaceRoot, 'node_modules', moduleName)
    .replace(/[/\\]/g, '[/\\\\]');
}

const existing = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [];

config.resolver.blockList = [
  ...existing,
  new RegExp(`${escapeForRegex('react-native')}[/\\\\].*`),
  new RegExp(`${escapeForRegex('react')}[/\\\\].*`),
];

module.exports = config;

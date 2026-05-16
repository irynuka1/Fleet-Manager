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

// Block the hoisted react-native@0.85 and react@19 at the workspace root
// so Metro always picks the app-local versions (react-native@0.76, react@18).
function escapeForRegex(p) {
  return path.resolve(workspaceRoot, 'node_modules', p).replace(/[/\\]/g, '[/\\\\]');
}

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  new RegExp(escapeForRegex('react-native') + '[/\\\\].*'),
  new RegExp(escapeForRegex('react') + '[/\\\\].*'),
];

module.exports = config;

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch monorepo workspaces.
config.watchFolders = [workspaceRoot];

// Resolve modules from app and workspace.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force pnpm symlink resolution.
config.resolver.disableHierarchicalLookup = true;

// Default platform extensions already include .web/.native, but be explicit.
config.resolver.sourceExts = [...config.resolver.sourceExts];

module.exports = config;

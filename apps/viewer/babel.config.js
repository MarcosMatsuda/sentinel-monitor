module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // react-native-reanimated/plugin MUST be the LAST plugin.
    plugins: ['react-native-reanimated/plugin'],
  };
};

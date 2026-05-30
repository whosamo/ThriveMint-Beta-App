module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Explicitly transform private class fields/methods so Hermes doesn't encounter
      // untransformed #field syntax from react-native core files (e.g. DebuggingOverlayRegistry.js).
      // The hermes-stable transform profile uses loose:true which can skip private field
      // declarations; running these without loose mode fixes the Hermes parse error.
      ['@babel/plugin-transform-class-properties'],
      ['@babel/plugin-transform-private-methods'],
      ['@babel/plugin-transform-private-property-in-object'],
    ],
  };
};

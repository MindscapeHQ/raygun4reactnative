module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { rootMode: 'upward' }],
  },
  transformIgnorePatterns: [ 'node_modules/(?!(react-native|@react-native|react-navigation|@react-navigation|@react-native-community|@react-native-firebase|@react-navigation/stack|@react-navigation/bottom-tabs|@react-navigation/drawer|@react-navigation/native|@react-navigation/material-bottom-tabs|@react-navigation/material-top-tabs|@react-navigation/stack|@react-navigation/web))' ],
  setupFiles: ['./__mocks__/RaygunNativeBridge.js']
};
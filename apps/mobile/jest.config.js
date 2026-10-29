/** @type {import('jest').Config} */
module.exports = {
  // jest-expo applies babel.config.js (NativeWind's jsxImportSource included).
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/app/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // pnpm layout (node_modules/.pnpm/<pkg>/node_modules/<pkg>): transpile RN/Expo packages, skip everything else.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|nativewind|react-native-css-interop|react-native-reanimated))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/api/**', '!src/**/*.test.{ts,tsx}'],
  coverageDirectory: 'coverage',
};

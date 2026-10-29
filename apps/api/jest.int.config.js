/**
 * Integration tests: `*.int-spec.ts`, real PostgreSQL (family_budget_test).
 * Each jest worker gets its own schema; see test/jest-global-setup.ts.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.int-spec.ts'],
  globalSetup: '<rootDir>/test/jest-global-setup.ts',
  globalTeardown: '<rootDir>/test/jest-global-teardown.ts',
  setupFiles: ['<rootDir>/test/jest-setup-env.ts'],
  testTimeout: 30000,
};

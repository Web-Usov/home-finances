/** Unit tests: `*.spec.ts`, no database (Prisma is mocked). */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/*.int-spec.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
};

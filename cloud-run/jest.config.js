/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  passWithNoTests: true,
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['rules\\.test\\.ts'],
}

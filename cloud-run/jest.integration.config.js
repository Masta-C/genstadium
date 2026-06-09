/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  passWithNoTests: true,
  rootDir: '../',
  testMatch: ['**/tests/integration/**/*.test.ts'],
  testTimeout: 15000,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/cloud-run/tsconfig.integration.json' }],
  },
}

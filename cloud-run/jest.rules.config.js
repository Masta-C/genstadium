/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  passWithNoTests: true,
  rootDir: '../',
  testMatch: ['**/tests/firestore.rules.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/cloud-run/tsconfig.json' }],
  },
}

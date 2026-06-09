/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  passWithNoTests: true,
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['rules\\.test\\.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/tests/**'],
  // Thresholds set at baseline-3 on 2026-06-09 (actual: 52.8% lines, 46.1% functions).
  // The "95%" seen without collectCoverageFrom only counted files imported by tests.
  // Ratchet these up by 5% every 2 sprints as test coverage grows — see #176, #178.
  coverageThreshold: {
    global: {
      lines: 50,
      functions: 43,
    },
  },
}

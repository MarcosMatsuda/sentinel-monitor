/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@sentinel-monitor/shared-types$': '<rootDir>/../../packages/shared-types/src/index',
  },
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};

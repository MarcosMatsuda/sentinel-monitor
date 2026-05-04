/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@sentinel-monitor/shared-types$': '<rootDir>/../../packages/shared-types/src/index',
    '^@sentinel-monitor/webrtc-config$': '<rootDir>/../../packages/webrtc-config/src/index',
  },
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@sentinel-monitor/shared-types$': '<rootDir>/../../packages/shared-types/src/index',
  },
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};

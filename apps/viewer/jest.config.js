/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@sentinel-monitor/shared-types$':
      '<rootDir>/../../packages/shared-types/src/index',
    '^@sentinel-monitor/design-tokens$':
      '<rootDir>/../../packages/design-tokens/src/index',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          module: 'commonjs',
          target: 'ES2022',
          strict: true,
          noUncheckedIndexedAccess: true,
        },
      },
    ],
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/presentation/stores/**/*.ts',
    'src/infrastructure/signaling/**/*.ts',
    'src/infrastructure/webrtc/webrtc-subscriber.native.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
};

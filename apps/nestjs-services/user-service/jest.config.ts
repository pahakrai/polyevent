import type { Config } from 'jest';

const config: Config = {
  displayName: 'user-service',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  setupFiles: ['<rootDir>/../../../jest.setup.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@polydom/shared-types$': '<rootDir>/../../../libs/shared-types/src/index.ts',
    '^@polydom/database-client$': '<rootDir>/../../../libs/database-client/src/index.ts',
    '^@polydom/nats-client$': '<rootDir>/../../../libs/nats-client/src/index.ts',
  },
};

export default config;

import type { Config } from 'jest';

const config: Config = {
  displayName: 'notification-service',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  setupFiles: ['<rootDir>/../../../jest.setup.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@polydom/database-client$': '<rootDir>/../../../libs/database-client/src/index.ts',
    '^@polydom/kafka-client$': '<rootDir>/../../../libs/kafka-client/src/index.ts',
    '^@polydom/shared-types$': '<rootDir>/../../../libs/shared-types/src/index.ts',
    '^@polydom/utils$': '<rootDir>/../../../libs/utils/src/index.ts',
  },
};

export default config;

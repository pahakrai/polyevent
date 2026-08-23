import type { Config } from 'jest';

const config: Config = {
  displayName: 'auth-service',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.smoke-spec.ts'],
  setupFiles: ['<rootDir>/../../../jest.setup.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@polydom/auth$': '<rootDir>/../../../libs/auth/src/index.ts',
    '^@polydom/shared-types$': '<rootDir>/../../../libs/shared-types/src/index.ts',
    '^@polydom/database-client$': '<rootDir>/../../../libs/database-client/src/index.ts',
    '^@polydom/kafka-client$': '<rootDir>/../../../libs/kafka-client/src/index.ts',
  },
};

export default config;

import type { Config } from 'jest';

const config: Config = {
  displayName: 'agent-service',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@polydom/auth$': '<rootDir>/../../../libs/auth/src/index.ts',
    '^@polydom/shared-types$': '<rootDir>/../../../libs/shared-types/src/index.ts',
  },
};

export default config;

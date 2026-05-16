import type { Config } from 'jest';

const config: Config = {
  displayName: 'user-service',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@polydom/shared-types$': '<rootDir>/../../../libs/shared-types/src/index.ts',
  },
};

export default config;

import type { Config } from 'jest';

const config: Config = {
  displayName: 'event-service',
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@polydom/shared-types$': '<rootDir>/../../../libs/shared-types/src/index.ts',
    '^@polydom/kafka-client$': '<rootDir>/../../../libs/kafka-client/src/index.ts',
    '^@polydom/nats-client$': '<rootDir>/../../../libs/nats-client/src/index.ts',
  },
};

export default config;

import type { Config } from 'jest';

const config: Config = {
  displayName: 'shared-types',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};

export default config;

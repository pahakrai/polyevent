import type { Config } from 'jest';

const config: Config = {
  displayName: 'utils',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};

export default config;

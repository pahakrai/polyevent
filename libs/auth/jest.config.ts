import type { Config } from 'jest';

const config: Config = {
  displayName: 'auth',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};

export default config;

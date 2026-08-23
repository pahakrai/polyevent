import type { Config } from 'jest';

const config: Config = {
  displayName: 'frontend',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.test.ts'],
};

export default config;

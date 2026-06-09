export default {
  displayName: 'admin-service',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../../coverage/apps/nestjs-services/admin-service',
  moduleNameMapper: {
    '^@polydom/auth$': '<rootDir>/../../../libs/auth/src/index.ts',
    '^@polydom/database-client$': '<rootDir>/../../../libs/database-client/src/index.ts',
    '^@polydom/shared-types$': '<rootDir>/../../../libs/shared-types/src/index.ts',
    '^@polydom/utils$': '<rootDir>/../../../libs/utils/src/index.ts',
  },
};

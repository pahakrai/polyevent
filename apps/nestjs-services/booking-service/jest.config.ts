export default {
  displayName: 'booking-service',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../../coverage/apps/nestjs-services/booking-service',
  moduleNameMapper: {
    '^@polydom/database-client$': '<rootDir>/../../../libs/database-client/src/index.ts',
    '^@polydom/kafka-client$': '<rootDir>/../../../libs/kafka-client/src/index.ts',
    '^@polydom/shared-types$': '<rootDir>/../../../libs/shared-types/src/index.ts',
  },
};

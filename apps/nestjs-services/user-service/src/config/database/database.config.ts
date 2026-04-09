import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  postgres: {
    url: process.env.USER_DATABASE_URL || process.env.NEON_USER_DATABASE_URL,
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/user_db',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
}));
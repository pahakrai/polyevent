import { Module } from '@nestjs/common';
import { PostgresClient } from '@polydom/database-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as schema from './schema';

dotenv.config();
const rootEnvPath = path.resolve(__dirname, '../../../../../.env');
dotenv.config({ path: rootEnvPath });

const databaseUrl = process.env.USE_NEON === 'true'
  ? process.env.NEON_BOOKING_DATABASE_URL || process.env.BOOKING_DATABASE_URL || ''
  : process.env.BOOKING_DATABASE_URL || '';

@Module({
  providers: [
    {
      provide: 'DATABASE',
      useFactory: () => {
        const client = new PostgresClient();
        return client.initialize(databaseUrl, schema);
      },
    },
  ],
  exports: ['DATABASE'],
})
export class DatabaseModule {}

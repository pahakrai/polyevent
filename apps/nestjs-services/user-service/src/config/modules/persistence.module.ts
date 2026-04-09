import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from '../database/database.config';
import { PostgresAdapter } from '../../infrastructure/persistence/adapters/postgres.adapter';
import { MongoAdapter } from '../../infrastructure/persistence/adapters/mongo.adapter';
import { RedisAdapter } from '../../infrastructure/persistence/adapters/redis.adapter';
import { DatabaseManager } from '../../infrastructure/persistence/database.manager';
import { PostgresUserProfileRepository } from '../../infrastructure/persistence/repositories/postgres-user-profile.repository';
import { PostgresUserProfileRepositoryFactory } from '../../infrastructure/persistence/factories/postgres-user-profile-repository.factory';

@Module({
  imports: [
    ConfigModule.forFeature(databaseConfig),
  ],
  providers: [
    // Adapters
    PostgresAdapter,
    MongoAdapter,
    RedisAdapter,

    // Database Manager
    DatabaseManager,

    // Repositories
    PostgresUserProfileRepository,

    // Factories
    PostgresUserProfileRepositoryFactory,
  ],
  exports: [
    DatabaseManager,
    PostgresUserProfileRepository,
    PostgresUserProfileRepositoryFactory,
  ],
})
export class PersistenceModule {}
import { Injectable } from '@nestjs/common';
import { UserProfileRepositoryFactory } from '../../../domain/repositories/user-profile-repository.factory';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { PostgresUserProfileRepository } from '../repositories/postgres-user-profile.repository';

@Injectable()
export class PostgresUserProfileRepositoryFactory implements UserProfileRepositoryFactory {
  constructor(private readonly repository: PostgresUserProfileRepository) {}

  createUserProfileRepository(): UserProfileRepository {
    return this.repository;
  }
}
import { Injectable } from '@nestjs/common';
import { UserProfileRepository } from '../../../domain/repositories/user-profile.repository';
import { UserProfile } from '../../../domain/entities/user-profile.entity';
import { UserRole } from '@polydom/shared-types';
import { PostgresAdapter } from '../adapters/postgres.adapter';
import { UserProfileMapper } from '../mappers/user-profile.mapper';
import { users } from '../../../database/schema';
import { eq, and, like, sql } from 'drizzle-orm';

@Injectable()
export class PostgresUserProfileRepository implements UserProfileRepository {
  constructor(private readonly adapter: PostgresAdapter) {}

  async findById(id: string): Promise<UserProfile | null> {
    const db = this.adapter.getClient();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (result.length === 0) {
      return null;
    }
    return UserProfileMapper.toDomain(result[0]);
  }

  async findAll(): Promise<UserProfile[]> {
    const db = this.adapter.getClient();
    const result = await db.select().from(users);
    return result.map(UserProfileMapper.toDomain);
  }

  async find(criteria: Partial<UserProfile>): Promise<UserProfile[]> {
    // Simplified implementation: find by exact match on available fields
    const db = this.adapter.getClient();
    const whereConditions: ReturnType<typeof eq>[] = [];

    if (criteria.id) {
      whereConditions.push(eq(users.id, criteria.id));
    }
    if (criteria.email) {
      whereConditions.push(eq(users.email, criteria.email));
    }
    // Add other fields as needed

    const result = await db.select().from(users).where(and(...whereConditions));
    return result.map(UserProfileMapper.toDomain);
  }

  async create(entity: UserProfile): Promise<UserProfile> {
    const db = this.adapter.getClient();
    const persistenceData = UserProfileMapper.toPersistence(entity);

    // Remove id if it's auto-generated (depends on schema)
    const result = await db.insert(users).values(persistenceData).returning();
    return UserProfileMapper.toDomain(result[0]);
  }

  async update(id: string, entity: Partial<UserProfile>): Promise<UserProfile> {
    const db = this.adapter.getClient();
    const persistenceData = UserProfileMapper.toPersistence(entity as UserProfile);

    // Remove id from update data
    delete persistenceData.id;

    const result = await db.update(users)
      .set(persistenceData)
      .where(eq(users.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`User with id ${id} not found`);
    }

    return UserProfileMapper.toDomain(result[0]);
  }

  async delete(id: string): Promise<void> {
    const db = this.adapter.getClient();
    await db.delete(users).where(eq(users.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const db = this.adapter.getClient();
    const result = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    return result.length > 0;
  }

  async count(criteria?: Partial<UserProfile>): Promise<number> {
    const db = this.adapter.getClient();

    if (!criteria) {
      const result = await db.select({ count: sql<number>`count(*)` }).from(users);
      return result[0]?.count ?? 0;
    }

    // Simplified: count by email only for demonstration
    const whereConditions: ReturnType<typeof eq>[] = [];
    if (criteria.email) {
      whereConditions.push(eq(users.email, criteria.email));
    }

    const result = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...whereConditions));

    return result[0]?.count ?? 0;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const db = this.adapter.getClient();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (result.length === 0) {
      return null;
    }
    return UserProfileMapper.toDomain(result[0]);
  }

  async findByRole(role: UserRole): Promise<UserProfile[]> {
    const db = this.adapter.getClient();
    const result = await db.select().from(users).where(eq(users.role, role as unknown as "USER" | "VENDOR" | "ADMIN"));
    return result.map(UserProfileMapper.toDomain);
  }

  async findNearLocation(location: any, radiusKm: number): Promise<UserProfile[]> {
    // This is a simplified implementation - actual geospatial queries require extensions
    console.warn('Geospatial queries not implemented');
    return [];
  }

  async emailExists(email: string): Promise<boolean> {
    const db = this.adapter.getClient();
    const result = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    return result.length > 0;
  }

  async findByMusicalGenre(genre: string): Promise<UserProfile[]> {
    // This requires querying the JSON preferences field
    // Simplified: return empty array for now
    console.warn('JSON query for musical genre not implemented');
    return [];
  }

  async findByPhone(phone: string): Promise<UserProfile | null> {
    const db = this.adapter.getClient();
    const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (result.length === 0) {
      return null;
    }
    return UserProfileMapper.toDomain(result[0]);
  }
}
import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../database/client';
import { users, User } from '../database/schema';
import { NatsProducer } from '@polydom/nats-client';
import { UpdateProfileDto } from './dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@Optional() private readonly natsProducer?: NatsProducer) {}

  async getProfile(userId: string): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  async findById(id: string): Promise<User> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const existing = await this.getProfile(userId);

    const updateData: Record<string, any> = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) updateData.bio = dto.bio;
    if (dto.interests !== undefined) updateData.interests = dto.interests;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.preferences !== undefined) updateData.preferences = dto.preferences;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    this.logger.log(`User profile updated: ${userId}`);

    try {
      await this.natsProducer?.publish('user.updated', {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(`NATS publish user.updated failed: ${(error as Error).message}`);
    }

    return updated;
  }
}

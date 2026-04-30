import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../database/client';
import { groups, groupMembers, Group, GroupMember } from '../database/schema';
import { CreateGroupDto, UpdateGroupDto } from './dto';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  async create(ownerId: string, dto: CreateGroupDto): Promise<Group> {
    const [group] = await db
      .insert(groups)
      .values({
        name: dto.name,
        description: dto.description,
        ownerId,
        maxMembers: dto.maxMembers,
        isPrivate: dto.isPrivate || false,
        interests: dto.interests || [],
      })
      .returning();

    await db.insert(groupMembers).values({
      groupId: group.id,
      userId: ownerId,
      role: 'ADMIN',
    });

    this.logger.log(`Group created: ${group.id} — "${group.name}" by ${ownerId}`);
    return group;
  }

  async findAll(page = 1, limit = 20, interests?: string) {
    const offset = (page - 1) * limit;

    let query = db.select().from(groups).where(eq(groups.isPrivate, false)).$dynamic();
    if (interests) {
      query = query.where(sql`${interests} = ANY(${groups.interests})`);
    }

    const data = await query.limit(limit).offset(offset).orderBy(groups.createdAt);

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(groups)
      .where(eq(groups.isPrivate, false));

    return { data, total: Number(row.count), page, limit };
  }

  async findById(id: string): Promise<Group & { members: GroupMember[] }> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!group) throw new NotFoundException(`Group ${id} not found`);

    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, id));

    return { ...group, members };
  }

  async findByUser(userId: string) {
    const data = await db
      .select({ group: groups, role: groupMembers.role })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, userId));

    return { data, total: data.length };
  }

  async update(id: string, userId: string, dto: UpdateGroupDto): Promise<Group> {
    const group = await this.findById(id);
    if (group.ownerId !== userId) {
      throw new ForbiddenException('Only the group owner can update the group');
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.maxMembers !== undefined) updateData.maxMembers = dto.maxMembers;
    if (dto.isPrivate !== undefined) updateData.isPrivate = dto.isPrivate;
    if (dto.interests !== undefined) updateData.interests = dto.interests;

    const [updated] = await db
      .update(groups)
      .set(updateData)
      .where(eq(groups.id, id))
      .returning();

    this.logger.log(`Group updated: ${id}`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const group = await this.findById(id);
    if (group.ownerId !== userId) {
      throw new ForbiddenException('Only the group owner can delete the group');
    }
    await db.delete(groups).where(eq(groups.id, id));
    this.logger.log(`Group deleted: ${id}`);
  }

  async join(groupId: string, userId: string): Promise<GroupMember> {
    const group = await this.findById(groupId);

    const [existing] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (existing) {
      throw new ForbiddenException('Already a member of this group');
    }

    if (group.maxMembers && (group.members?.length || 0) >= group.maxMembers) {
      throw new ForbiddenException('Group is full');
    }

    const [member] = await db
      .insert(groupMembers)
      .values({ groupId, userId, role: 'MEMBER' })
      .returning();

    this.logger.log(`User ${userId} joined group ${groupId}`);
    return member;
  }

  async leave(groupId: string, userId: string): Promise<void> {
    const group = await this.findById(groupId);
    if (group.ownerId === userId) {
      throw new ForbiddenException('Owner cannot leave the group. Transfer ownership or delete the group.');
    }

    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

    this.logger.log(`User ${userId} left group ${groupId}`);
  }

  async addMember(groupId: string, ownerId: string, userId: string): Promise<GroupMember> {
    const group = await this.findById(groupId);
    if (group.ownerId !== ownerId) {
      throw new ForbiddenException('Only the group owner can add members');
    }

    const [member] = await db
      .insert(groupMembers)
      .values({ groupId, userId, role: 'MEMBER' })
      .returning();

    this.logger.log(`User ${userId} added to group ${groupId} by ${ownerId}`);
    return member;
  }

  async removeMember(groupId: string, ownerId: string, userId: string): Promise<void> {
    const group = await this.findById(groupId);
    if (group.ownerId !== ownerId) {
      throw new ForbiddenException('Only the group owner can remove members');
    }
    if (userId === ownerId) {
      throw new ForbiddenException('Cannot remove the group owner');
    }

    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

    this.logger.log(`User ${userId} removed from group ${groupId} by ${ownerId}`);
  }
}

import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../database/client';
import {
  groups,
  groupMembers,
  groupMessages,
  groupPosts,
  musicianProfiles,
  users,
  Group,
  GroupMember,
  GroupMessage,
  GroupPost,
} from '../database/schema';
import { CreateGroupDto, UpdateGroupDto } from './dto';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  // ═══════════════════════════════════════════════════════════════════
  //  CRUD
  // ═══════════════════════════════════════════════════════════════════

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

    // Attach member counts
    const enriched = await Promise.all(
      data.map(async (g) => {
        const [cnt] = await db
          .select({ count: sql<number>`count(*)` })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, g.id));
        return { ...g, memberCount: Number(cnt?.count ?? 0) };
      }),
    );

    return { data: enriched, total: Number(row.count), page, limit };
  }

  async findById(id: string): Promise<Group & { members: GroupMember[]; memberCount: number }> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);
    if (!group) throw new NotFoundException(`Group ${id} not found`);

    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, id));

    const [cnt] = await db
      .select({ count: sql<number>`count(*)` })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, id));

    return { ...group, members, memberCount: Number(cnt?.count ?? 0) };
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

    if (existing) throw new ForbiddenException('Already a member');
    if (group.maxMembers && group.memberCount >= group.maxMembers) {
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
      throw new ForbiddenException('Owner cannot leave. Transfer ownership or delete the group.');
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
    if (group.ownerId !== ownerId) throw new ForbiddenException('Only the group owner can remove');
    if (userId === ownerId) throw new ForbiddenException('Cannot remove the group owner');

    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
    this.logger.log(`User ${userId} removed from group ${groupId} by ${ownerId}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Group Posts
  // ═══════════════════════════════════════════════════════════════════

  async createPost(
    groupId: string,
    userId: string,
    dto: { type?: string; title?: string; content: string; eventId?: string; instrumentsWanted?: string[] },
  ): Promise<GroupPost> {
    await this.findById(groupId);

    const [post] = await db
      .insert(groupPosts)
      .values({
        groupId,
        userId,
        type: (dto.type as any) || 'DISCUSSION',
        title: dto.title,
        content: dto.content,
        eventId: dto.eventId,
        instrumentsWanted: dto.instrumentsWanted || [],
      })
      .returning();

    this.logger.log(`Post created in group ${groupId}: ${post.id}`);
    return post;
  }

  async findPosts(
    groupId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: GroupPost[]; total: number }> {
    await this.findById(groupId);
    const offset = (page - 1) * limit;

    const data = await db
      .select()
      .from(groupPosts)
      .where(eq(groupPosts.groupId, groupId))
      .orderBy(desc(groupPosts.createdAt))
      .limit(limit)
      .offset(offset);

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(groupPosts)
      .where(eq(groupPosts.groupId, groupId));

    return { data, total: Number(row.count) };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Group Chat (Messages)
  // ═══════════════════════════════════════════════════════════════════

  async sendMessage(groupId: string, userId: string, content: string): Promise<GroupMessage> {
    await this.findById(groupId);

    const [msg] = await db
      .insert(groupMessages)
      .values({ groupId, userId, content })
      .returning();

    this.logger.log(`Message in group ${groupId} by ${userId}`);
    return msg;
  }

  async findMessages(
    groupId: string,
    after?: string,
    limit = 50,
  ): Promise<{ data: GroupMessage[]; hasMore: boolean }> {
    await this.findById(groupId);

    const conditions: any[] = [eq(groupMessages.groupId, groupId)];

    if (after) {
      conditions.push(sql`${groupMessages.id} > ${after}`);
    }

    const data = await db
      .select()
      .from(groupMessages)
      .where(and(...conditions))
      .orderBy(groupMessages.createdAt)
      .limit(limit + 1);

    const hasMore = data.length > limit;
    if (hasMore) data.pop();

    return { data, hasMore };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Invite Links
  // ═══════════════════════════════════════════════════════════════════

  async generateInviteLink(groupId: string): Promise<{ inviteCode: string }> {
    const group = await this.findById(groupId);
    // Simple hash of group ID + timestamp as invite code
    const code = Buffer.from(`${groupId}:${Date.now()}`).toString('base64url').slice(0, 12);
    // In production, store in Redis with TTL; for now return directly
    return { inviteCode: code };
  }

  async joinViaInvite(inviteCode: string, userId: string): Promise<GroupMember> {
    // Decode is only valid for groups created in this session; production needs Redis lookup
    // For now, extract groupId from the code directly (simplified)
    // Real implementation: Redis GET invite:{code} → groupId
    throw new ForbiddenException('Invite codes require Redis. Use direct join for now.');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Suggested Groups
  // ═══════════════════════════════════════════════════════════════════

  async suggestGroups(userId: string): Promise<{ data: (Group & { memberCount: number; matchScore: number })[] }> {
    const [profile] = await db
      .select()
      .from(musicianProfiles)
      .where(eq(musicianProfiles.userId, userId))
      .limit(1);

    const userInterests = profile?.genres || [];

    // Find groups with overlapping interests, ordered by member count
    const allGroups = await db
      .select()
      .from(groups)
      .where(eq(groups.isPrivate, false));

    const scored = await Promise.all(
      allGroups.map(async (g) => {
        const overlap = g.interests?.filter((i) => userInterests.includes(i)).length || 0;
        const matchScore = Math.min(overlap * 25, 100);

        const [cnt] = await db
          .select({ count: sql<number>`count(*)` })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, g.id));

        return { ...g, memberCount: Number(cnt?.count ?? 0), matchScore };
      }),
    );

    scored.sort((a, b) => b.matchScore - a.matchScore || b.memberCount - a.memberCount);
    return { data: scored.slice(0, 5) };
  }
}

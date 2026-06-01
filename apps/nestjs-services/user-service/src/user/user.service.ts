import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../database/client';
import { users, User, musicianProfiles, MusicianProfile } from '../database/schema';
import { NatsProducer } from '@polydom/nats-client';
import { UpdateProfileDto, MusicianProfileFieldsDto } from './dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@Optional() private readonly natsProducer?: NatsProducer) {}

  // ── Profile CRUD ──────────────────────────────────────────────────

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

    // Upsert musician profile if provided
    if (dto.musicianProfile) {
      await this.upsertMusicianProfile(userId, dto.musicianProfile);
    }

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

  // ── Musician profile ──────────────────────────────────────────────

  async getMusicianProfile(userId: string): Promise<MusicianProfile | null> {
    const [profile] = await db
      .select()
      .from(musicianProfiles)
      .where(eq(musicianProfiles.userId, userId))
      .limit(1);
    return profile ?? null;
  }

  async upsertMusicianProfile(
    userId: string,
    fields: MusicianProfileFieldsDto,
  ): Promise<MusicianProfile> {
    const existing = await this.getMusicianProfile(userId);

    const data: Record<string, any> = {};
    if (fields.instruments !== undefined) data.instruments = fields.instruments;
    if (fields.skillLevel !== undefined) data.skillLevel = fields.skillLevel;
    if (fields.genres !== undefined) data.genres = fields.genres;
    if (fields.intent !== undefined) data.intent = fields.intent;
    if (fields.lookingFor !== undefined) data.lookingFor = fields.lookingFor;
    if (fields.bio !== undefined) data.bio = fields.bio;
    if (fields.influences !== undefined) data.influences = fields.influences;
    if (fields.availableDays !== undefined) data.availableDays = fields.availableDays;

    if (existing) {
      const [updated] = await db
        .update(musicianProfiles)
        .set(data)
        .where(eq(musicianProfiles.userId, userId))
        .returning();
      this.logger.log(`Musician profile updated: ${userId}`);
      return updated;
    }

    const [created] = await db
      .insert(musicianProfiles)
      .values({ userId, ...data })
      .returning();
    this.logger.log(`Musician profile created: ${userId}`);
    return created;
  }

  async browseMusicians(params: {
    instruments?: string[];
    genres?: string[];
    skillLevel?: string;
    intent?: string;
    lat?: number;
    lon?: number;
    radiusKm?: number;
    page?: number;
    limit?: number;
  }): Promise<{ data: MusicianProfile[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 50);
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (params.instruments?.length) {
      conditions.push(
        sql`${musicianProfiles.instruments} && ${params.instruments}::text[]`,
      );
    }
    if (params.genres?.length) {
      conditions.push(
        sql`${musicianProfiles.genres} && ${params.genres}::text[]`,
      );
    }
    if (params.skillLevel) {
      conditions.push(eq(musicianProfiles.skillLevel, params.skillLevel as any));
    }
    if (params.intent) {
      conditions.push(eq(musicianProfiles.intent, params.intent as any));
    }
    // Exclude JUST_BROWSING unless explicitly requested
    if (!params.intent) {
      conditions.push(
        sql`${musicianProfiles.intent} != 'JUST_BROWSING'`,
      );
    }

    // Base query — join with users for location data
    let query = db
      .select({
        profile: musicianProfiles,
        userLocation: users.location,
      })
      .from(musicianProfiles)
      .innerJoin(users, eq(musicianProfiles.userId, users.id))
      .where(and(...conditions));

    // Count query
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(musicianProfiles)
      .innerJoin(users, eq(musicianProfiles.userId, users.id))
      .where(and(...conditions));
    const total = Number(countResult[0]?.count ?? 0);

    // Paginate
    const rows = await query.limit(limit).offset(offset);

    // In-memory proximity filtering + sorting (simpler than PostGIS for now)
    let data: MusicianProfile[] = rows.map((r: { profile: MusicianProfile }) => r.profile);

    if (params.lat != null && params.lon != null) {
      const radiusKm = params.radiusKm ?? 50;
      data = data.filter((_profile: MusicianProfile, i: number) => {
        const loc = rows[i]?.userLocation as any;
        if (!loc?.latitude || !loc?.longitude) return false;
        const dist = haversineKm(
          params.lat!,
          params.lon!,
          Number(loc.latitude),
          Number(loc.longitude),
        );
        return dist <= radiusKm;
      });
      // Approximate sort by distance (not exact since we filtered post-query)
    }

    return { data, total };
  }

  async discoverForYou(userId: string): Promise<{
    musicians: MusicianProfile[];
    totalMusicians: number;
  }> {
    const myProfile = await this.getMusicianProfile(userId);
    if (!myProfile || myProfile.intent === 'JUST_BROWSING') {
      // Fallback: show active musicians nearby
      const fallback = await this.browseMusicians({ intent: 'OPEN_TO_JAM', limit: 10 });
      return { musicians: fallback.data, totalMusicians: fallback.total };
    }

    const user = await this.getProfile(userId);
    const userLoc = user.location as any;

    // Build discovery query based on what I'm looking for + my genres
    const params: any = {
      instruments: myProfile.lookingFor?.length ? myProfile.lookingFor : undefined,
      genres: myProfile.genres?.length ? myProfile.genres : undefined,
      limit: 10,
    };

    if (userLoc?.latitude && userLoc?.longitude) {
      params.lat = Number(userLoc.latitude);
      params.lon = Number(userLoc.longitude);
      params.radiusKm = 50;
    }

    // Show musicians who are actively looking
    params.intent = 'LOOKING_TO_JOIN';
    let result = await this.browseMusicians(params);

    // If few results, broaden to OPEN_TO_JAM
    if (result.total < 3) {
      params.intent = 'OPEN_TO_JAM';
      result = await this.browseMusicians(params);
    }

    return {
      musicians: result.data,
      totalMusicians: result.total,
    };
  }
}

// ── Haversine helper ──────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

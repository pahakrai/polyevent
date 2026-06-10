import { Injectable, Logger, NotFoundException, ConflictException, GoneException, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, sql, like, or, inArray } from 'drizzle-orm';
import { db } from '../database/client';
import { events, eventInvitations, Event, NewEvent, EventInvitation, NewEventInvitation } from '../database/schema';
import { RedisClient } from '@polydom/database-client';
import { BaseProducer } from '@polydom/kafka-client';
import { NatsProducer } from '@polydom/nats-client';
import {
  EVENT_LIFECYCLE_TOPIC,
  EventLifecycleType,
  EventLifecycleMessage,
} from '@polydom/kafka-client';
import { CreateEventDto, UpdateEventDto, EventSearchDto, CreateJamSessionDto } from './dto';

function vendorLockKey(vendorId: string, timeslotId: string): string {
  return `vendor_lock:${vendorId}:${timeslotId}`;
}

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private readonly lockTtlSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly redisClient?: RedisClient,
    @Optional() private readonly kafkaProducer?: BaseProducer,
    @Optional() private readonly natsProducer?: NatsProducer,
  ) {
    this.lockTtlSeconds = parseInt(
      configService.get<string>('VENDOR_BOOKING_LOCK_TTL_SECONDS') || '600',
      10,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CRUD
  // ═══════════════════════════════════════════════════════════════════

  async create(dto: CreateEventDto): Promise<Event> {
    const [event] = await db
      .insert(events)
      .values({
        vendorId: dto.vendorId,
        venueId: dto.venueId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        subCategory: dto.subCategory,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        location: dto.location,
        price: dto.price || { price: 0, currency: 'USD' },
        maxAttendees: dto.maxAttendees,
        tags: dto.tags || [],
        images: dto.images || [],
        ageRestriction: dto.ageRestriction,
        isRecurring: dto.isRecurring || false,
        recurringRule: dto.recurringRule,
        eventType: (dto.eventType as any) || 'FORMAL',
        instrumentsWanted: dto.instrumentsWanted || [],
        hostId: dto.hostId,
        groupId: dto.groupId,
      })
      .returning();

    this.logger.log(`Event created: ${event.id} — "${event.title}"`);
    await this.publishLifecycleEvent(event, 'event_created');
    return event;
  }

  async createWithVendor(dto: CreateEventDto & { timeSlotId?: string }): Promise<Event> {
    if (dto.vendorId && dto.timeSlotId) {
      const acquired = await this.acquireVendorLock(dto.vendorId, dto.timeSlotId);
      if (!acquired) {
        throw new ConflictException(
          `Vendor ${dto.vendorId} timeslot ${dto.timeSlotId} is already locked.`,
        );
      }
    }

    const [event] = await db
      .insert(events)
      .values({
        vendorId: dto.vendorId,
        venueId: dto.venueId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        subCategory: dto.subCategory,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        location: dto.location,
        price: dto.price || { price: 0, currency: 'USD' },
        maxAttendees: dto.maxAttendees,
        tags: dto.tags || [],
        images: dto.images || [],
        ageRestriction: dto.ageRestriction,
        isRecurring: dto.isRecurring || false,
        recurringRule: dto.recurringRule,
        timeSlotId: dto.timeSlotId,
        vendorStatus: dto.vendorId && dto.timeSlotId ? 'PENDING_CONFIRMATION' : 'NONE',
        vendorLockedAt: dto.vendorId && dto.timeSlotId ? new Date() : undefined,
        eventType: (dto.eventType as any) || 'FORMAL',
      })
      .returning();

    this.logger.log(`Event created with vendor: ${event.id}`);
    await this.publishLifecycleEvent(event, 'event_created');
    return event;
  }

  async findById(id: string): Promise<Event> {
    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) throw new NotFoundException(`Event ${id} not found`);
    return event;
  }

  async findAll(page = 1, limit = 20): Promise<{ data: Event[]; total: number }> {
    const offset = (page - 1) * limit;
    const data = await db
      .select()
      .from(events)
      .orderBy(events.startTime)
      .limit(limit)
      .offset(offset);
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(events);
    return { data, total: Number(row.count) };
  }

  async findByVendor(vendorId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const data = await db
      .select()
      .from(events)
      .where(eq(events.vendorId, vendorId))
      .orderBy(events.startTime)
      .limit(limit)
      .offset(offset);
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(eq(events.vendorId, vendorId));
    return { data, total: Number(row.count) };
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const existing = await this.findById(id);
    const updateData: Record<string, any> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.subCategory !== undefined) updateData.subCategory = dto.subCategory;
    if (dto.startTime !== undefined) updateData.startTime = new Date(dto.startTime);
    if (dto.endTime !== undefined) updateData.endTime = new Date(dto.endTime);
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.maxAttendees !== undefined) updateData.maxAttendees = dto.maxAttendees;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.images !== undefined) updateData.images = dto.images;
    if (dto.ageRestriction !== undefined) updateData.ageRestriction = dto.ageRestriction;

    const [updated] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();

    this.logger.log(`Event updated: ${id}`);
    await this.publishLifecycleEvent(updated, 'event_updated', Object.keys(updateData));
    return updated;
  }

  async publish(id: string): Promise<Event> {
    const event = await this.findById(id);
    if (event.status !== 'DRAFT') {
      throw new Error(`Cannot publish event with status ${event.status}`);
    }
    const [updated] = await db
      .update(events)
      .set({ status: 'PUBLISHED' })
      .where(eq(events.id, id))
      .returning();
    this.logger.log(`Event published: ${id}`);
    await this.publishLifecycleEvent(updated, 'event_published');
    return updated;
  }

  async cancel(id: string, reason?: string): Promise<Event> {
    const event = await this.findById(id);
    const [updated] = await db
      .update(events)
      .set({ status: 'CANCELLED' })
      .where(eq(events.id, id))
      .returning();
    this.logger.log(`Event cancelled: ${id}`);
    await this.publishLifecycleEvent(updated, 'event_cancelled');
    return updated;
  }

  async complete(id: string): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set({ status: 'COMPLETED' })
      .where(eq(events.id, id))
      .returning();
    this.logger.log(`Event completed: ${id}`);
    await this.publishLifecycleEvent(updated, 'event_completed');
    return updated;
  }

  async markSoldOut(id: string): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set({ status: 'SOLD_OUT' })
      .where(eq(events.id, id))
      .returning();
    this.logger.log(`Event sold out: ${id}`);
    await this.publishLifecycleEvent(updated, 'event_sold_out');
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Vendor booking
  // ═══════════════════════════════════════════════════════════════════

  private async acquireVendorLock(vendorId: string, timeslotId: string): Promise<boolean> {
    if (!this.redisClient || !this.redisClient.isConnected()) return true;
    const key = vendorLockKey(vendorId, timeslotId);
    return this.redisClient.setNX(key, 'locked', this.lockTtlSeconds);
  }

  private async releaseVendorLock(vendorId: string, timeslotId: string): Promise<void> {
    if (!this.redisClient || !this.redisClient.isConnected()) return;
    await this.redisClient.del(vendorLockKey(vendorId, timeslotId));
  }

  private async vendorLockExists(vendorId: string, timeslotId: string): Promise<boolean> {
    if (!this.redisClient || !this.redisClient.isConnected()) return true;
    const exists = await this.redisClient.exists(vendorLockKey(vendorId, timeslotId));
    return exists > 0;
  }

  async confirmVendorBooking(eventId: string): Promise<Event> {
    const event = await this.findById(eventId);
    if (event.vendorStatus !== 'PENDING_CONFIRMATION') {
      throw new ConflictException(`Vendor status is ${event.vendorStatus}`);
    }
    if (!event.timeSlotId) throw new ConflictException('No timeslot');
    const lockExists = await this.vendorLockExists(event.vendorId!, event.timeSlotId);
    if (!lockExists) {
      await db.update(events).set({ vendorStatus: 'CANCELLED' }).where(eq(events.id, eventId));
      throw new GoneException('Vendor lock expired');
    }
    const [updated] = await db
      .update(events)
      .set({ vendorStatus: 'CONFIRMED' })
      .where(eq(events.id, eventId))
      .returning();
    this.logger.log(`Vendor confirmed: ${eventId}`);
    return updated;
  }

  async releaseVendorBooking(eventId: string): Promise<Event> {
    const event = await this.findById(eventId);
    if (event.timeSlotId) await this.releaseVendorLock(event.vendorId!, event.timeSlotId);
    const [updated] = await db
      .update(events)
      .set({ vendorStatus: 'CANCELLED' })
      .where(eq(events.id, eventId))
      .returning();
    return updated;
  }

  async rebookVendor(eventId: string): Promise<Event> {
    const event = await this.findById(eventId);
    if (!event.timeSlotId) throw new ConflictException('No timeslot');
    const acquired = await this.acquireVendorLock(event.vendorId!, event.timeSlotId);
    if (!acquired) throw new ConflictException('Timeslot already locked');
    const [updated] = await db
      .update(events)
      .set({ vendorStatus: 'PENDING_CONFIRMATION', vendorLockedAt: new Date() })
      .where(eq(events.id, eventId))
      .returning();
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Invitations
  // ═══════════════════════════════════════════════════════════════════

  async inviteUser(eventId: string, userId: string, inviterId: string): Promise<EventInvitation> {
    const event = await this.findById(eventId);
    if (!event.allowInvites) throw new ConflictException('Invites disabled');
    const [existing] = await db
      .select()
      .from(eventInvitations)
      .where(and(eq(eventInvitations.eventId, eventId), eq(eventInvitations.userId, userId)))
      .limit(1);
    if (existing) throw new ConflictException('User already invited or RSVP\'d');
    const [inv] = await db
      .insert(eventInvitations)
      .values({ eventId, userId, inviterId, type: 'CREATOR_INVITE', status: 'PENDING' })
      .returning();
    return inv;
  }

  async acceptInvite(invitationId: string): Promise<EventInvitation> {
    const [inv] = await db
      .update(eventInvitations)
      .set({ status: 'ACCEPTED' })
      .where(eq(eventInvitations.id, invitationId))
      .returning();
    if (!inv) throw new NotFoundException('Invitation not found');
    await db
      .update(events)
      .set({ currentBookings: sql`current_bookings + 1` })
      .where(eq(events.id, inv.eventId));
    return inv;
  }

  async rejectInvite(invitationId: string): Promise<EventInvitation> {
    const [inv] = await db
      .update(eventInvitations)
      .set({ status: 'REJECTED' })
      .where(eq(eventInvitations.id, invitationId))
      .returning();
    if (!inv) throw new NotFoundException('Invitation not found');
    return inv;
  }

  async requestJoin(eventId: string, userId: string): Promise<EventInvitation> {
    const event = await this.findById(eventId);
    if (!event.allowInvites) throw new ConflictException('Join requests disabled');
    const [existing] = await db
      .select()
      .from(eventInvitations)
      .where(and(eq(eventInvitations.eventId, eventId), eq(eventInvitations.userId, userId)))
      .limit(1);
    if (existing) throw new ConflictException('Already requested or invited');
    const [inv] = await db
      .insert(eventInvitations)
      .values({ eventId, userId, type: 'USER_REQUEST', status: 'PENDING' })
      .returning();
    return inv;
  }

  async respondToRequest(invitationId: string, accept: boolean): Promise<EventInvitation> {
    const [inv] = await db
      .update(eventInvitations)
      .set({ status: accept ? 'ACCEPTED' : 'REJECTED' })
      .where(eq(eventInvitations.id, invitationId))
      .returning();
    if (!inv) throw new NotFoundException('Request not found');
    if (accept) {
      await db
        .update(events)
        .set({ currentBookings: sql`current_bookings + 1` })
        .where(eq(events.id, inv.eventId));
    }
    return inv;
  }

  async listInvitations(eventId: string): Promise<EventInvitation[]> {
    return db
      .select()
      .from(eventInvitations)
      .where(eq(eventInvitations.eventId, eventId));
  }

  async disableInvites(id: string): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set({ allowInvites: false })
      .where(eq(events.id, id))
      .returning();
    return updated;
  }

  async enableInvites(id: string): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set({ allowInvites: true })
      .where(eq(events.id, id))
      .returning();
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Jam Sessions
  // ═══════════════════════════════════════════════════════════════════

  async createJamSession(hostId: string, dto: CreateJamSessionDto): Promise<Event> {
    const [event] = await db
      .insert(events)
      .values({
        title: dto.title,
        description: dto.description,
        category: 'MUSIC',
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        location: dto.location,
        price: { price: 0, currency: 'USD' },
        pricingModel: 'FREE',
        maxAttendees: dto.maxParticipants || 10,
        tags: dto.genres || [],
        status: 'PUBLISHED',
        eventType: 'JAM_SESSION',
        instrumentsWanted: dto.instrumentsWanted,
        hostId,
        groupId: dto.groupId,
        allowInvites: true,
      })
      .returning();

    this.logger.log(`Jam session created: ${event.id} by host ${hostId}`);

    try {
      await this.natsProducer?.publish('jam.created', {
        eventId: event.id,
        hostId,
        title: event.title,
        instrumentsWanted: event.instrumentsWanted,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`NATS jam.created failed: ${(err as Error).message}`);
    }

    return event;
  }

  async findJamSessions(params: {
    instrumentsWanted?: string[];
    genres?: string[];
    lat?: number;
    lon?: number;
    radiusKm?: number;
    page?: number;
    limit?: number;
    groupId?: string;
  }): Promise<{ data: Event[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 50);
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(events.eventType, 'JAM_SESSION'), eq(events.status, 'PUBLISHED')];

    if (params.groupId) {
      conditions.push(eq(events.groupId, params.groupId));
    }

    if (params.instrumentsWanted?.length) {
      conditions.push(
        sql`${events.instrumentsWanted} && ${params.instrumentsWanted}::text[]`,
      );
    }

    if (params.genres?.length) {
      conditions.push(
        sql`${events.tags} && ${params.genres}::text[]`,
      );
    }

    const data = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(events.startTime)
      .limit(limit)
      .offset(offset);

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(and(...conditions));

    return { data, total: Number(row.count) };
  }

  async rsvp(eventId: string, userId: string): Promise<{ invitation: EventInvitation; event: Event }> {
    const event = await this.findById(eventId);
    if (event.eventType !== 'JAM_SESSION') {
      throw new BadRequestException('RSVP is only available for jam sessions');
    }
    if (event.status !== 'PUBLISHED') {
      throw new ConflictException('Jam session is not open');
    }

    const [existing] = await db
      .select()
      .from(eventInvitations)
      .where(and(eq(eventInvitations.eventId, eventId), eq(eventInvitations.userId, userId)))
      .limit(1);

    if (existing) {
      throw new ConflictException('Already RSVP\'d');
    }

    const [inv] = await db
      .insert(eventInvitations)
      .values({ eventId, userId, type: 'USER_REQUEST', status: 'ACCEPTED' })
      .returning();

    const [updated] = await db
      .update(events)
      .set({ rsvpCount: sql`rsvp_count + 1` })
      .where(eq(events.id, eventId))
      .returning();

    // Auto-mark sold out if full
    if (updated!.maxAttendees && updated!.rsvpCount >= updated!.maxAttendees) {
      await db.update(events).set({ status: 'SOLD_OUT' }).where(eq(events.id, eventId));
    }

    try {
      await this.natsProducer?.publish('jam.rsvp.created', {
        eventId,
        userId,
        rsvpCount: updated!.rsvpCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`NATS jam.rsvp.created failed`);
    }

    return { invitation: inv, event: updated! };
  }

  async cancelRsvp(eventId: string, userId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(eventInvitations)
      .where(and(
        eq(eventInvitations.eventId, eventId),
        eq(eventInvitations.userId, userId),
        eq(eventInvitations.type, 'USER_REQUEST'),
      ))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('No RSVP found');
    }

    await db.delete(eventInvitations).where(eq(eventInvitations.id, existing.id));
    await db
      .update(events)
      .set({ rsvpCount: sql`GREATEST(rsvp_count - 1, 0)` })
      .where(eq(events.id, eventId));

    // Reopen if was SOLD_OUT
    const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (event && event.status === 'SOLD_OUT' && event.maxAttendees && event.rsvpCount < event.maxAttendees) {
      await db.update(events).set({ status: 'PUBLISHED' }).where(eq(events.id, eventId));
    }
  }

  async listAttendees(eventId: string): Promise<EventInvitation[]> {
    return db
      .select()
      .from(eventInvitations)
      .where(and(
        eq(eventInvitations.eventId, eventId),
        eq(eventInvitations.status, 'ACCEPTED'),
      ));
  }

  async incrementBookings(id: string): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set({ currentBookings: sql`current_bookings + 1` })
      .where(eq(events.id, id))
      .returning();
    if (!updated) throw new NotFoundException(`Event ${id} not found`);
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Search
  // ═══════════════════════════════════════════════════════════════════

  async search(dto: EventSearchDto): Promise<{ data: Event[]; total: number }> {
    const { query, categories, lat, lon, radiusKm = 20, page = 1, limit = 20 } = dto;
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (query) {
      conditions.push(
        or(like(events.title, `%${query}%`), like(events.description, `%${query}%`)),
      );
    }
    if (categories?.length) {
      conditions.push(inArray(events.category, categories as any));
    }

    const data = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(events.startTime)
      .limit(limit)
      .offset(offset);

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(and(...conditions));

    return { data, total: Number(row.count) };
  }

  async findByCategory(category: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const data = await db
      .select()
      .from(events)
      .where(eq(events.category, category as any))
      .orderBy(events.startTime)
      .limit(limit)
      .offset(offset);
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(eq(events.category, category as any));
    return { data, total: Number(row.count) };
  }

  async findNearby(lat: number, lon: number, radiusKm = 20, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const data = await db
      .select()
      .from(events)
      .orderBy(events.startTime)
      .limit(limit)
      .offset(offset);
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(events);
    return { data, total: Number(row.count) };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════════════════════════════

  private async publishLifecycleEvent(
    event: Event,
    type: EventLifecycleType,
    changedFields?: string[],
  ): Promise<void> {
    if (!this.kafkaProducer || !this.kafkaProducer.isConnected()) return;
    const message: EventLifecycleMessage = {
      eventId: event.id,
      vendorId: event.vendorId || 'jam_host',
      type,
      timestamp: new Date().toISOString(),
      event: {
        title: event.title,
        description: event.description,
        category: event.category,
        subCategory: event.subCategory ?? undefined,
        genres: [],
        tags: event.tags,
        location: {
          venueName: (event.location as any)?.venueName || '',
          address: (event.location as any)?.address || '',
          city: (event.location as any)?.city || '',
          country: (event.location as any)?.country || '',
          latitude: (event.location as any)?.latitude || 0,
          longitude: (event.location as any)?.longitude || 0,
        },
        schedule: {
          startDate: event.startTime.toISOString(),
          endDate: event.endTime.toISOString(),
          timezone: 'UTC',
        },
        pricing: {
          minPrice: (event.price as any)?.min || 0,
          maxPrice: (event.price as any)?.max || 0,
          currency: (event.price as any)?.currency || 'EUR',
        },
        capacity: event.maxAttendees || 0,
        ageRestriction: event.ageRestriction != null ? String(event.ageRestriction) : undefined,
        images: event.images,
      },
    };
    if (changedFields) message.changedFields = changedFields;
    try {
      await this.kafkaProducer.send(EVENT_LIFECYCLE_TOPIC, message, message.eventId);
    } catch (error) {
      this.logger.warn(`Failed to publish lifecycle event: ${(error as Error).message}`);
    }
  }
}
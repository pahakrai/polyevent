import { Injectable, Logger, NotFoundException, ConflictException, GoneException, Optional } from '@nestjs/common';
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
import { CreateEventDto, UpdateEventDto, EventSearchDto } from './dto';

// ── Vendor lock key helper ───────────────────────────────────────────
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
  //  CRUD (existing)
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
        price: dto.price,
        maxAttendees: dto.maxAttendees,
        tags: dto.tags || [],
        images: dto.images || [],
        ageRestriction: dto.ageRestriction,
        isRecurring: dto.isRecurring || false,
        recurringRule: dto.recurringRule,
      })
      .returning();

    this.logger.log(`Event created: ${event.id} — "${event.title}"`);
    await this.publishLifecycleEvent(event, 'event_created');
    return event;
  }

  /**
   * Create an event AND lock a vendor in one call.
   * If vendorId + timeSlotId are provided, acquires Redis lock before writing the event row.
   */
  async createWithVendor(dto: CreateEventDto & { timeSlotId?: string }): Promise<Event> {
    // If a vendor+timeslot is specified, try to lock it
    if (dto.vendorId && dto.timeSlotId) {
      const acquired = await this.acquireVendorLock(dto.vendorId, dto.timeSlotId);
      if (!acquired) {
        throw new ConflictException(
          `Vendor ${dto.vendorId} timeslot ${dto.timeSlotId} is already locked. Please try again.`,
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
        price: dto.price,
        maxAttendees: dto.maxAttendees,
        tags: dto.tags || [],
        images: dto.images || [],
        ageRestriction: dto.ageRestriction,
        isRecurring: dto.isRecurring || false,
        recurringRule: dto.recurringRule,
        timeSlotId: dto.timeSlotId,
        vendorStatus: dto.vendorId && dto.timeSlotId ? 'PENDING_CONFIRMATION' : 'NONE',
        vendorLockedAt: dto.vendorId && dto.timeSlotId ? new Date() : undefined,
      })
      .returning();

    this.logger.log(
      `Event created with vendor: ${event.id} — vendorStatus=${event.vendorStatus}`,
    );
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

    const changedFields = Object.keys(updateData);
    this.logger.log(`Event updated: ${id} — changed: ${changedFields.join(', ')}`);

    await this.publishLifecycleEvent(updated, 'event_updated', changedFields);
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

    this.logger.log(`Event cancelled: ${id} — reason: ${reason || 'not specified'}`);
    await this.publishLifecycleEvent(updated, 'event_cancelled');
    return updated;
  }

  async complete(id: string): Promise<Event> {
    const event = await this.findById(id);

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
    const event = await this.findById(id);

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
  //  Vendor booking lock lifecycle
  // ═══════════════════════════════════════════════════════════════════

  /** Acquire a Redis lock for the vendor+timeslot. Returns true if acquired. */
  private async acquireVendorLock(vendorId: string, timeslotId: string): Promise<boolean> {
    if (!this.redisClient || !this.redisClient.isConnected()) {
      this.logger.warn('Redis not available — skipping vendor lock (dev mode)');
      return true;
    }
    const key = vendorLockKey(vendorId, timeslotId);
    const acquired = await this.redisClient.setNX(key, 'locked', this.lockTtlSeconds);
    this.logger.log(
      `Vendor lock ${key}: ${acquired ? 'ACQUIRED' : 'DENIED'} (TTL=${this.lockTtlSeconds}s)`,
    );
    return acquired;
  }

  /** Release the Redis lock. Idempotent — no error if key doesn't exist. */
  private async releaseVendorLock(vendorId: string, timeslotId: string): Promise<void> {
    if (!this.redisClient || !this.redisClient.isConnected()) return;
    const key = vendorLockKey(vendorId, timeslotId);
    await this.redisClient.del(key);
    this.logger.log(`Vendor lock released: ${key}`);
  }

  /** Check if the Redis lock for this vendor+timeslot still exists. */
  private async vendorLockExists(vendorId: string, timeslotId: string): Promise<boolean> {
    if (!this.redisClient || !this.redisClient.isConnected()) return true; // dev fallback
    const key = vendorLockKey(vendorId, timeslotId);
    const exists = await this.redisClient.exists(key);
    return exists > 0;
  }

  /**
   * Confirm the vendor booking for an event.
   * Requires the Redis lock to still be held. If expired, throws GoneException.
   */
  async confirmVendorBooking(eventId: string): Promise<Event> {
    const event = await this.findById(eventId);

    if (event.vendorStatus !== 'PENDING_CONFIRMATION') {
      throw new ConflictException(
        `Event vendor status is ${event.vendorStatus}, expected PENDING_CONFIRMATION`,
      );
    }

    if (!event.timeSlotId) {
      throw new ConflictException('Event has no timeslot — cannot confirm vendor');
    }

    const lockExists = await this.vendorLockExists(event.vendorId, event.timeSlotId);
    if (!lockExists) {
      // Lock expired — update to cancelled so the user sees it
      await db
        .update(events)
        .set({ vendorStatus: 'CANCELLED' })
        .where(eq(events.id, eventId));
      throw new GoneException(
        'Vendor booking lock has expired. Please re-book the vendor.',
      );
    }

    const [updated] = await db
      .update(events)
      .set({ vendorStatus: 'CONFIRMED' })
      .where(eq(events.id, eventId))
      .returning();

    await this.releaseVendorLock(event.vendorId, event.timeSlotId);
    this.logger.log(`Vendor booking CONFIRMED for event ${eventId}`);
    await this.publishLifecycleEvent(updated, 'vendor_confirmed');
    return updated;
  }

  /**
   * Release the vendor booking lock without confirming.
   * Sets vendorStatus to CANCELLED and removes the Redis lock.
   */
  async releaseVendorBooking(eventId: string): Promise<Event> {
    const event = await this.findById(eventId);

    if (event.vendorStatus !== 'PENDING_CONFIRMATION') {
      throw new ConflictException(
        `Event vendor status is ${event.vendorStatus}, cannot release`,
      );
    }

    if (event.timeSlotId) {
      await this.releaseVendorLock(event.vendorId, event.timeSlotId);
    }

    const [updated] = await db
      .update(events)
      .set({ vendorStatus: 'CANCELLED' })
      .where(eq(events.id, eventId))
      .returning();

    this.logger.log(`Vendor booking RELEASED for event ${eventId}`);
    return updated;
  }

  /**
   * Re-attempt to lock a vendor after the previous lock expired or was cancelled.
   * Acquires a new Redis lock, resets vendorLockedAt and vendorStatus.
   */
  async rebookVendor(eventId: string): Promise<Event> {
    const event = await this.findById(eventId);

    if (!event.timeSlotId) {
      throw new ConflictException('Event has no timeslot — cannot book vendor');
    }

    if (event.vendorStatus === 'CONFIRMED') {
      throw new ConflictException('Vendor is already confirmed');
    }

    const acquired = await this.acquireVendorLock(event.vendorId, event.timeSlotId);
    if (!acquired) {
      throw new ConflictException(
        `Vendor ${event.vendorId} timeslot ${event.timeSlotId} is currently locked by another booking.`,
      );
    }

    const [updated] = await db
      .update(events)
      .set({
        vendorStatus: 'PENDING_CONFIRMATION',
        vendorLockedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();

    this.logger.log(`Vendor RE-BOOKED for event ${eventId}`);
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Invitations
  // ═══════════════════════════════════════════════════════════════════

  /** Creator invites a user to the event. */
  async inviteUser(eventId: string, userId: string, inviterId: string): Promise<EventInvitation> {
    const event = await this.findById(eventId);

    if (!event.allowInvites) {
      throw new ConflictException('Invites are disabled for this event.');
    }

    if (event.maxAttendees && event.currentBookings >= event.maxAttendees) {
      throw new ConflictException('Event is at full capacity.');
    }

    // Check for existing invitation
    const [existing] = await db
      .select()
      .from(eventInvitations)
      .where(
        and(
          eq(eventInvitations.eventId, eventId),
          eq(eventInvitations.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('User already has a pending invitation for this event.');
    }

    const [invitation] = await db
      .insert(eventInvitations)
      .values({
        eventId,
        userId,
        inviterId,
        type: 'CREATOR_INVITE',
        status: 'PENDING',
      })
      .returning();

    this.logger.log(`Invite: ${inviterId} → user ${userId} for event ${eventId}`);
    return invitation;
  }

  /** User accepts an invitation — increments currentBookings atomically. */
  async acceptInvite(invitationId: string): Promise<EventInvitation> {
    const [inv] = await db
      .select()
      .from(eventInvitations)
      .where(eq(eventInvitations.id, invitationId))
      .limit(1);
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== 'PENDING') {
      throw new ConflictException(`Invitation is already ${inv.status}`);
    }

    const event = await this.findById(inv.eventId);
    if (!event.allowInvites) {
      throw new ConflictException('Invites are disabled for this event.');
    }
    if (event.maxAttendees && event.currentBookings >= event.maxAttendees) {
      throw new ConflictException('Event is at full capacity.');
    }

    // Update invitation + increment bookings in a transaction-like sequence
    const [updated] = await db
      .update(eventInvitations)
      .set({ status: 'ACCEPTED' })
      .where(eq(eventInvitations.id, invitationId))
      .returning();

    await db
      .update(events)
      .set({ currentBookings: sql`current_bookings + 1` })
      .where(eq(events.id, inv.eventId));

    // Check if now sold out
    if (event.maxAttendees && event.currentBookings + 1 >= event.maxAttendees) {
      await db
        .update(events)
        .set({ allowInvites: false })
        .where(eq(events.id, inv.eventId));
      this.logger.log(`Event ${inv.eventId}: capacity reached, invites auto-disabled`);
    }

    this.logger.log(`Invite accepted: ${invitationId} — event ${inv.eventId}`);
    return updated;
  }

  /** User rejects an invitation. */
  async rejectInvite(invitationId: string): Promise<EventInvitation> {
    const [inv] = await db
      .select()
      .from(eventInvitations)
      .where(eq(eventInvitations.id, invitationId))
      .limit(1);
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== 'PENDING') {
      throw new ConflictException(`Invitation is already ${inv.status}`);
    }

    const [updated] = await db
      .update(eventInvitations)
      .set({ status: 'REJECTED' })
      .where(eq(eventInvitations.id, invitationId))
      .returning();

    this.logger.log(`Invite rejected: ${invitationId}`);
    return updated;
  }

  /** User requests to join an event (no invite needed — open event). */
  async requestJoin(eventId: string, userId: string): Promise<EventInvitation> {
    const event = await this.findById(eventId);

    if (!event.allowInvites) {
      throw new ConflictException('This event is not accepting new participants.');
    }

    if (event.maxAttendees && event.currentBookings >= event.maxAttendees) {
      throw new ConflictException('Event is at full capacity.');
    }

    // Check for duplicate
    const [existing] = await db
      .select()
      .from(eventInvitations)
      .where(
        and(
          eq(eventInvitations.eventId, eventId),
          eq(eventInvitations.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('You already have a pending request for this event.');
    }

    const [invitation] = await db
      .insert(eventInvitations)
      .values({
        eventId,
        userId,
        type: 'USER_REQUEST',
        status: 'PENDING',
      })
      .returning();

    this.logger.log(`Join request: user ${userId} → event ${eventId}`);
    return invitation;
  }

  /** Creator accepts or rejects a user's join request. */
  async respondToRequest(invitationId: string, accept: boolean): Promise<EventInvitation> {
    const [inv] = await db
      .select()
      .from(eventInvitations)
      .where(eq(eventInvitations.id, invitationId))
      .limit(1);
    if (!inv) throw new NotFoundException('Request not found');
    if (inv.type !== 'USER_REQUEST') {
      throw new ConflictException('This is not a join request.');
    }
    if (inv.status !== 'PENDING') {
      throw new ConflictException(`Request is already ${inv.status}`);
    }

    if (accept) {
      const event = await this.findById(inv.eventId);
      if (event.maxAttendees && event.currentBookings >= event.maxAttendees) {
        throw new ConflictException('Event is at full capacity.');
      }

      await db
        .update(eventInvitations)
        .set({ status: 'ACCEPTED' })
        .where(eq(eventInvitations.id, invitationId));

      await db
        .update(events)
        .set({ currentBookings: sql`current_bookings + 1` })
        .where(eq(events.id, inv.eventId));

      // Auto-disable invites if full
      if (event.maxAttendees && event.currentBookings + 1 >= event.maxAttendees) {
        await db
          .update(events)
          .set({ allowInvites: false })
          .where(eq(events.id, inv.eventId));
      }
    } else {
      await db
        .update(eventInvitations)
        .set({ status: 'REJECTED' })
        .where(eq(eventInvitations.id, invitationId));
    }

    const [updated] = await db
      .select()
      .from(eventInvitations)
      .where(eq(eventInvitations.id, invitationId))
      .limit(1);

    this.logger.log(
      `Join request ${invitationId}: ${accept ? 'ACCEPTED' : 'REJECTED'}`,
    );
    return updated;
  }

  /** List all invitations for an event. */
  async listInvitations(eventId: string): Promise<EventInvitation[]> {
    return db
      .select()
      .from(eventInvitations)
      .where(eq(eventInvitations.eventId, eventId))
      .orderBy(eventInvitations.createdAt);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Quota / invites toggle
  // ═══════════════════════════════════════════════════════════════════

  async disableInvites(eventId: string): Promise<Event> {
    const event = await this.findById(eventId);
    const [updated] = await db
      .update(events)
      .set({ allowInvites: false })
      .where(eq(events.id, eventId))
      .returning();

    this.logger.log(`Invites disabled for event ${eventId}`);
    return updated;
  }

  async enableInvites(eventId: string): Promise<Event> {
    const event = await this.findById(eventId);

    // Only allow re-enabling if there's capacity
    if (event.maxAttendees && event.currentBookings >= event.maxAttendees) {
      throw new ConflictException('Cannot enable invites — event is at full capacity.');
    }

    const [updated] = await db
      .update(events)
      .set({ allowInvites: true })
      .where(eq(events.id, eventId))
      .returning();

    this.logger.log(`Invites enabled for event ${eventId}`);
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Search (existing)
  // ═══════════════════════════════════════════════════════════════════

  async search(dto: EventSearchDto) {
    const conditions: any[] = [eq(events.status, 'PUBLISHED')];

    if (dto.query) {
      conditions.push(
        or(
          like(events.title, `%${dto.query}%`),
          like(events.description, `%${dto.query}%`),
        ),
      );
    }

    if (dto.categories?.length) {
      conditions.push(inArray(events.category, dto.categories as any));
    }

    if (dto.tags?.length) {
      conditions.push(
        or(...dto.tags.map((t) => sql`${t} = ANY(${events.tags})`)),
      );
    }

    if (dto.startDate) {
      conditions.push(sql`${events.startTime} >= ${new Date(dto.startDate)}`);
    }

    if (dto.endDate) {
      conditions.push(sql`${events.startTime} <= ${new Date(dto.endDate)}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const offset = ((dto.page || 1) - 1) * (dto.limit || 20);
    const data = await db
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(events.startTime)
      .limit(dto.limit || 20)
      .offset(offset);

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(whereClause);

    return { data, total: Number(row.count) };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Private helpers
  // ═══════════════════════════════════════════════════════════════════

  private async publishLifecycleEvent(
    event: Event,
    type: EventLifecycleType,
    changedFields?: string[],
  ): Promise<void> {
    const msg: EventLifecycleMessage = {
      eventId: event.id,
      vendorId: event.vendorId,
      type,
      timestamp: new Date().toISOString(),
      ...(changedFields ? { changedFields } : {}),
    };

    try {
      await this.kafkaProducer?.send(EVENT_LIFECYCLE_TOPIC, msg);
    } catch (err) {
      this.logger.warn(`Kafka publish failed: ${(err as Error).message}`);
    }

    try {
      await this.natsProducer?.publish(`event.${type}`, msg);
    } catch (err) {
      this.logger.warn(`NATS publish failed: ${(err as Error).message}`);
    }
  }
}

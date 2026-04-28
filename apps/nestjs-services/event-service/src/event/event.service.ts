import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { eq, and, sql, like, or, inArray } from 'drizzle-orm';
import { db } from '../database/client';
import { events, Event, NewEvent } from '../database/schema';
import { BaseProducer } from '@polydom/kafka-client';
import {
  EVENT_LIFECYCLE_TOPIC,
  EventLifecycleType,
  EventLifecycleMessage,
} from '@polydom/kafka-client';
import { CreateEventDto, UpdateEventDto, EventSearchDto } from './dto';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(@Optional() private readonly kafkaProducer?: BaseProducer) {}

  // ── CRUD ────────────────────────────────────────────────────────────

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

  // ── Search ──────────────────────────────────────────────────────────

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

    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;

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

    return {
      data,
      total: Number(row.count),
      page,
      limit,
      query: dto.query,
    };
  }

  async findByCategory(category: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const data = await db
      .select()
      .from(events)
      .where(and(eq(events.category, category as any), eq(events.status, 'PUBLISHED')))
      .orderBy(events.startTime)
      .limit(limit)
      .offset(offset);

    return { data, total: data.length, category };
  }

  async findNearby(lat: number, lon: number, radiusKm = 20, page = 1, limit = 20) {
    // PostGIS would handle this natively; for dev, filter in-app
    const offset = (page - 1) * limit;
    const data = await db
      .select()
      .from(events)
      .where(eq(events.status, 'PUBLISHED'))
      .orderBy(events.startTime)
      .limit(limit)
      .offset(offset);

    // Approximate geo-filter: simple lat/lon bounding box
    const approxDegPerKm = 0.009;
    const filtered = data.filter((e) => {
      const loc = e.location as any;
      if (!loc?.latitude || !loc?.longitude) return false;
      const dlat = Math.abs(loc.latitude - lat);
      const dlon = Math.abs(loc.longitude - lon);
      return Math.sqrt(dlat ** 2 + dlon ** 2) <= radiusKm * approxDegPerKm;
    });

    return { data: filtered, total: filtered.length, center: { lat, lon }, radiusKm };
  }

  // ── Kafka Event Production ──────────────────────────────────────────

  private async publishLifecycleEvent(
    event: Event,
    type: EventLifecycleType,
    changedFields?: string[],
  ): Promise<void> {
    if (!this.kafkaProducer) return;
    try {
      const location = event.location as Record<string, any>;
      const price = event.price as Record<string, any>;

      const message: EventLifecycleMessage = {
        eventId: event.id,
        vendorId: event.vendorId,
        type,
        timestamp: new Date().toISOString(),
        event: {
          title: event.title,
          description: event.description,
          category: event.category,
          subCategory: event.subCategory ?? undefined,
          genres: event.tags || [],
          tags: event.tags || [],
          location: {
            venueName: location?.venueName || location?.name || '',
            address: location?.address || '',
            city: location?.city || '',
            country: location?.country || '',
            latitude: location?.latitude || location?.lat || 0,
            longitude: location?.longitude || location?.lon || location?.lng || 0,
          },
          schedule: {
            startDate: event.startTime.toISOString(),
            endDate: event.endTime.toISOString(),
            timezone: 'UTC',
            recurrence: event.recurringRule
              ? { frequency: 'weekly' as const, interval: 1 }
              : undefined,
          },
          pricing: {
            minPrice: price?.minPrice || price?.price || 0,
            maxPrice: price?.maxPrice || price?.price || 0,
            currency: price?.currency || 'USD',
          },
          capacity: event.maxAttendees || 0,
          ageRestriction: event.ageRestriction?.toString(),
          images: event.images || [],
        },
        changedFields,
      };

      await this.kafkaProducer.send(EVENT_LIFECYCLE_TOPIC, message, event.id);
      this.logger.debug(`Produced ${type} to ${EVENT_LIFECYCLE_TOPIC} for event ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to produce lifecycle event: ${(error as Error).message}`);
      // Non-blocking: event CRUD succeeds even if Kafka is down
    }
  }
}

import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db } from '../database/client';
import { eventTypes, EventType, NewEventType } from '../database/schema';
import { CreateEventTypeDto, UpdateEventTypeDto } from './dto';

@Injectable()
export class EventTypeService {
  private readonly logger = new Logger(EventTypeService.name);

  async create(dto: CreateEventTypeDto): Promise<EventType> {
    const existing = await this.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictException(`Event type "${dto.slug}" already exists`);
    }

    const [created] = await db
      .insert(eventTypes)
      .values({
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        category: dto.category as any,
        icon: dto.icon,
        attributesSchema: dto.attributesSchema ?? {},
        allowRsvp: dto.allowRsvp ?? false,
      } as NewEventType)
      .returning();

    this.logger.log(`Event type created: ${created.slug} (${created.category})`);
    return created;
  }

  async update(id: string, dto: UpdateEventTypeDto): Promise<EventType> {
    await this.findById(id);
    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.attributesSchema !== undefined) updateData.attributesSchema = dto.attributesSchema;
    if (dto.allowRsvp !== undefined) updateData.allowRsvp = dto.allowRsvp;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await db
      .update(eventTypes)
      .set(updateData)
      .where(eq(eventTypes.id, id))
      .returning();
    this.logger.log(`Event type updated: ${updated.slug}`);
    return updated;
  }

  async findAll(): Promise<EventType[]> {
    return db
      .select()
      .from(eventTypes)
      .orderBy(sql`${eventTypes.category}, ${eventTypes.name}`);
  }

  async findById(id: string): Promise<EventType> {
    const [type] = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.id, id))
      .limit(1);
    if (!type) throw new NotFoundException(`Event type ${id} not found`);
    return type;
  }

  async findBySlug(slug: string): Promise<EventType | null> {
    const [type] = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.slug, slug))
      .limit(1);
    return type ?? null;
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../database/client';
import { timeSlots, TimeSlot } from '../database/schema';
import { CreateTimeslotDto, BulkCreateTimeslotDto, UpdateTimeslotDto } from './dto';

@Injectable()
export class TimeslotService {
  private readonly logger = new Logger(TimeslotService.name);

  async create(dto: CreateTimeslotDto): Promise<TimeSlot> {
    const [slot] = await db
      .insert(timeSlots)
      .values({
        venueId: dto.venueId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        status: (dto.status as any) || 'AVAILABLE',
        recurrenceRule: dto.recurrenceRule,
        priceOverride: dto.priceOverride,
        maxBookings: dto.maxBookings || 1,
      })
      .returning();

    this.logger.log(`TimeSlot created: ${slot.id} for venue ${slot.venueId}`);
    return slot;
  }

  async createBulk(dto: BulkCreateTimeslotDto): Promise<{ count: number }> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const [startHour, startMin] = dto.startTime.split(':').map(Number);
    const [endHour, endMin] = dto.endTime.split(':').map(Number);

    const slots: any[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      if (dto.daysOfWeek.includes(current.getDay())) {
        const slotStart = new Date(current);
        slotStart.setHours(startHour, startMin, 0, 0);
        const slotEnd = new Date(current);
        slotEnd.setHours(endHour, endMin, 0, 0);

        slots.push({
          venueId: dto.venueId,
          startTime: slotStart,
          endTime: slotEnd,
          status: 'AVAILABLE' as const,
          priceOverride: dto.priceOverride,
          maxBookings: 1,
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (slots.length > 0) {
      await db.insert(timeSlots).values(slots);
    }

    this.logger.log(`Bulk created ${slots.length} time slots for venue ${dto.venueId}`);
    return { count: slots.length };
  }

  async findByVenueId(venueId: string, startDate?: string, endDate?: string) {
    let query = db
      .select()
      .from(timeSlots)
      .where(eq(timeSlots.venueId, venueId))
      .$dynamic();

    if (startDate) {
      query = query.where(gte(timeSlots.startTime, new Date(startDate)));
    }
    if (endDate) {
      query = query.where(lte(timeSlots.endTime, new Date(endDate)));
    }

    const data = await query.orderBy(timeSlots.startTime);
    return { data, total: data.length };
  }

  async findById(id: string): Promise<TimeSlot> {
    const [slot] = await db.select().from(timeSlots).where(eq(timeSlots.id, id)).limit(1);
    if (!slot) throw new NotFoundException(`TimeSlot ${id} not found`);
    return slot;
  }

  async update(id: string, dto: UpdateTimeslotDto): Promise<TimeSlot> {
    await this.findById(id);
    const updateData: Record<string, any> = {};
    if (dto.startTime !== undefined) updateData.startTime = new Date(dto.startTime);
    if (dto.endTime !== undefined) updateData.endTime = new Date(dto.endTime);
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.recurrenceRule !== undefined) updateData.recurrenceRule = dto.recurrenceRule;
    if (dto.priceOverride !== undefined) updateData.priceOverride = dto.priceOverride;
    if (dto.maxBookings !== undefined) updateData.maxBookings = dto.maxBookings;

    const [updated] = await db
      .update(timeSlots)
      .set(updateData)
      .where(eq(timeSlots.id, id))
      .returning();

    this.logger.log(`TimeSlot updated: ${id}`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await db.delete(timeSlots).where(eq(timeSlots.id, id));
    this.logger.log(`TimeSlot deleted: ${id}`);
  }

  async block(id: string): Promise<TimeSlot> {
    await this.findById(id);
    const [updated] = await db
      .update(timeSlots)
      .set({ status: 'BLOCKED' })
      .where(eq(timeSlots.id, id))
      .returning();
    this.logger.log(`TimeSlot blocked: ${id}`);
    return updated;
  }
}

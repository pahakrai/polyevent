import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db } from '../database/client';
import { venues, Venue } from '../database/schema';
import { CreateVenueDto, UpdateVenueDto } from './dto';

@Injectable()
export class VenueService {
  private readonly logger = new Logger(VenueService.name);

  async create(dto: CreateVenueDto): Promise<Venue> {
    const [venue] = await db
      .insert(venues)
      .values({
        vendorId: dto.vendorId,
        name: dto.name,
        description: dto.description,
        type: dto.type as any,
        capacity: dto.capacity,
        address: dto.address,
        location: dto.location,
        amenities: dto.amenities || [],
        images: dto.images || [],
        pricingModel: (dto.pricingModel as any) || 'PER_HOUR',
        hourlyRate: dto.hourlyRate,
      })
      .returning();

    this.logger.log(`Venue created: ${venue.id} — "${venue.name}"`);
    return venue;
  }

  async findByVendorId(vendorId: string) {
    const data = await db
      .select()
      .from(venues)
      .where(eq(venues.vendorId, vendorId));
    return { data, total: data.length };
  }

  async findById(id: string): Promise<Venue> {
    const [venue] = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
    if (!venue) throw new NotFoundException(`Venue ${id} not found`);
    return venue;
  }

  async update(id: string, dto: UpdateVenueDto): Promise<Venue> {
    await this.findById(id);
    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.capacity !== undefined) updateData.capacity = dto.capacity;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.amenities !== undefined) updateData.amenities = dto.amenities;
    if (dto.images !== undefined) updateData.images = dto.images;
    if (dto.pricingModel !== undefined) updateData.pricingModel = dto.pricingModel;
    if (dto.hourlyRate !== undefined) updateData.hourlyRate = dto.hourlyRate;
    if (dto.isAvailable !== undefined) updateData.isAvailable = dto.isAvailable;

    const [updated] = await db
      .update(venues)
      .set(updateData)
      .where(eq(venues.id, id))
      .returning();

    this.logger.log(`Venue updated: ${id}`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await db.update(venues).set({ isAvailable: false }).where(eq(venues.id, id));
    this.logger.log(`Venue deactivated: ${id}`);
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db } from '../database/client';
import { vendors, Vendor, NewVendor } from '../database/schema';
import { CreateVendorDto, UpdateVendorDto } from './dto';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);

  async create(dto: CreateVendorDto): Promise<Vendor> {
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: dto.userId,
        businessName: dto.businessName,
        description: dto.description,
        category: dto.category as any,
        subCategory: dto.subCategory,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        website: dto.website,
        address: dto.address || {},
        location: dto.location || {},
        coverImage: dto.coverImage,
      })
      .returning();

    this.logger.log(`Vendor created: ${vendor.id} — "${vendor.businessName}"`);
    return vendor;
  }

  async findAll(page = 1, limit = 20, category?: string) {
    const offset = (page - 1) * limit;

    let query = db.select().from(vendors).$dynamic();
    if (category) {
      query = query.where(eq(vendors.category, category as any));
    }

    const data = await query.limit(limit).offset(offset);

    const [row] = await db.select({ count: sql<number>`count(*)` }).from(vendors);
    return { data, total: Number(row.count), page, limit };
  }

  async findById(id: string): Promise<Vendor> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!vendor) throw new NotFoundException(`Vendor ${id} not found`);
    return vendor;
  }

  async findByUserId(userId: string): Promise<Vendor | null> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
    return vendor || null;
  }

  async update(id: string, dto: UpdateVendorDto): Promise<Vendor> {
    const existing = await this.findById(id);
    const updateData: Record<string, any> = {};
    if (dto.businessName !== undefined) updateData.businessName = dto.businessName;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.subCategory !== undefined) updateData.subCategory = dto.subCategory;
    if (dto.contactEmail !== undefined) updateData.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) updateData.contactPhone = dto.contactPhone;
    if (dto.website !== undefined) updateData.website = dto.website;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.coverImage !== undefined) updateData.coverImage = dto.coverImage;

    const [updated] = await db
      .update(vendors)
      .set(updateData)
      .where(eq(vendors.id, id))
      .returning();

    this.logger.log(`Vendor updated: ${id}`);
    return updated;
  }

  async verify(id: string): Promise<Vendor> {
    await this.findById(id);
    const [updated] = await db
      .update(vendors)
      .set({ verificationStatus: 'VERIFIED' })
      .where(eq(vendors.id, id))
      .returning();
    this.logger.log(`Vendor verified: ${id}`);
    return updated;
  }

  async getStats(id: string) {
    await this.findById(id);
    return {
      vendorId: id,
      totalEvents: 0,
      totalBookings: 0,
      totalRevenue: 0,
      averageRating: 0,
      cancellationRate: 0,
    };
  }
}

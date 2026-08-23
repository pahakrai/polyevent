import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { db } from '../database/client';
import { vendors, reviews, Review, NewReview } from '../database/schema';
import { CreateReviewDto } from './dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  /**
   * Create a review and atomically update the vendor's aggregate rating
   * (`rating` and `totalReviews`) so the reputation system stays consistent.
   */
  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, dto.vendorId))
      .limit(1);
    if (!vendor) throw new NotFoundException(`Vendor ${dto.vendorId} not found`);

    const [review] = await db
      .insert(reviews)
      .values({
        vendorId: dto.vendorId,
        userId,
        rating: dto.rating,
        comment: dto.comment,
      } as NewReview)
      .returning();

    // Update aggregate in a single atomic statement:
    // rating = (old_rating * old_count + new_rating) / (old_count + 1)
    await db
      .update(vendors)
      .set({
        totalReviews: sql`total_reviews + 1`,
        rating: sql`(rating * total_reviews + ${dto.rating}) / (total_reviews + 1)`,
      })
      .where(eq(vendors.id, dto.vendorId));

    this.logger.log(`Review ${review.id} created for vendor ${dto.vendorId} (${dto.rating}★)`);
    return review;
  }

  async findByVendor(
    vendorId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Review[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const data = await db
      .select()
      .from(reviews)
      .where(eq(reviews.vendorId, vendorId))
      .orderBy(sql`created_at DESC`)
      .limit(limit)
      .offset(offset);

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.vendorId, vendorId));

    return { data, total: Number(row.count), page, limit };
  }
}

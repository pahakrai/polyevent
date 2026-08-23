import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  create(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    if (!userId) {
      // Fallback to body userId for direct (non-gateway) clients.
      return this.reviewService.create((dto as any).userId, dto);
    }
    return this.reviewService.create(userId, dto);
  }

  @Get('vendor/:vendorId')
  findByVendor(
    @Param('vendorId') vendorId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.reviewService.findByVendor(vendorId, page, limit);
  }
}

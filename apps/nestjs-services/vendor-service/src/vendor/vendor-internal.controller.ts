import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CreateInternalVendorDto } from './dto';

@Controller('internal/vendors')
export class VendorInternalController {
  constructor(private readonly vendorService: VendorService) {}

  private checkInternalKey(key?: string) {
    const expected = process.env.INTERNAL_SERVICE_KEY || 'internal-secret';
    if (key !== expected) {
      throw new UnauthorizedException('Invalid internal service key');
    }
  }

  @Post()
  create(
    @Headers('x-internal-key') internalKey: string,
    @Body() dto: CreateInternalVendorDto,
  ) {
    this.checkInternalKey(internalKey);
    return this.vendorService.create(dto);
  }

  @Delete(':id')
  delete(
    @Headers('x-internal-key') internalKey: string,
    @Param('id') id: string,
  ) {
    this.checkInternalKey(internalKey);
    return this.vendorService.deleteById(id);
  }

  @Get('by-user/:userId')
  findByUserId(
    @Headers('x-internal-key') internalKey: string,
    @Param('userId') userId: string,
  ) {
    this.checkInternalKey(internalKey);
    return this.vendorService.findByUserId(userId);
  }
}

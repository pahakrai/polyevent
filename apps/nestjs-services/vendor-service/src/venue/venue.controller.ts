import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { VenueService } from './venue.service';
import { CreateVenueDto, UpdateVenueDto } from './dto';

@Controller()
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post('vendors/:vendorId/venues')
  create(@Param('vendorId') vendorId: string, @Body() dto: CreateVenueDto) {
    return this.venueService.create({ ...dto, vendorId });
  }

  @Get('vendors/:vendorId/venues')
  findByVendorId(@Param('vendorId') vendorId: string) {
    return this.venueService.findByVendorId(vendorId);
  }

  @Get('venues/:id')
  findById(@Param('id') id: string) {
    return this.venueService.findById(id);
  }

  @Patch('venues/:id')
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venueService.update(id, dto);
  }

  @Delete('venues/:id')
  remove(@Param('id') id: string) {
    return this.venueService.remove(id);
  }
}

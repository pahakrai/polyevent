import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CreateVendorDto, UpdateVendorDto } from './dto';

@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  create(@Body() dto: CreateVendorDto) {
    return this.vendorService.create(dto);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('category') category?: string,
  ) {
    return this.vendorService.findAll(page, limit, category);
  }

  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.vendorService.findByUserId(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.vendorService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorService.update(id, dto);
  }

  @Post(':id/verify')
  verify(@Param('id') id: string) {
    return this.vendorService.verify(id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.vendorService.getStats(id);
  }
}

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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles, ResourceOwnerGuard, ResourceOwner } from '@polydom/auth';
import { VendorService } from './vendor.service';
import { CreateVendorDto, UpdateVendorDto } from './dto';

@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('USER', 'VENDOR', 'ADMIN')
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
  @UseGuards(AuthGuard('jwt'), RolesGuard, ResourceOwnerGuard)
  @Roles('USER', 'VENDOR', 'ADMIN')
  @ResourceOwner('vendor:self')
  findByUserId(@Param('userId') userId: string) {
    return this.vendorService.findByUserId(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.vendorService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard, ResourceOwnerGuard)
  @Roles('VENDOR', 'ADMIN')
  @ResourceOwner('vendor:id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorService.update(id, dto);
  }

  @Post(':id/verify')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  verify(@Param('id') id: string) {
    return this.vendorService.verify(id);
  }

  @Get(':id/stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard, ResourceOwnerGuard)
  @Roles('VENDOR', 'ADMIN')
  @ResourceOwner('vendor:id')
  getStats(@Param('id') id: string) {
    return this.vendorService.getStats(id);
  }
}

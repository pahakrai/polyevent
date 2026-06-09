import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { FeatureFlagService } from './feature-flag.service';

@ApiTags('admin/flags')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/flags')
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags' })
  list() {
    return this.featureFlagService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a feature flag' })
  create(@Body() dto: any, @Req() req: Request) {
    const admin = (req as any).user;
    return this.featureFlagService.create(dto, admin.sub);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a feature flag' })
  update(@Param('key') key: string, @Body() dto: any, @Req() req: Request) {
    const admin = (req as any).user;
    return this.featureFlagService.update(key, dto, admin.sub);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete a feature flag' })
  delete(@Param('key') key: string, @Req() req: Request) {
    const admin = (req as any).user;
    return this.featureFlagService.delete(key, admin.sub);
  }
}

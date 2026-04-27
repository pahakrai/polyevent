import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { EventService } from './event.service';
import { EventSearchDto } from './dto';

@Controller('events')
export class EventSearchController {
  constructor(private readonly eventService: EventService) {}

  @Get('search')
  search(@Query() dto: EventSearchDto) {
    return this.eventService.search(dto);
  }

  @Get('category/:category')
  findByCategory(
    @Param('category') category: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.eventService.findByCategory(category, page, limit);
  }

  @Get('nearby')
  findNearby(
    @Query('lat') lat: number,
    @Query('lon') lon: number,
    @Query('radiusKm', new DefaultValuePipe(20), ParseIntPipe) radiusKm: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.eventService.findNearby(lat, lon, radiusKm, page, limit);
  }
}

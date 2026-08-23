import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { EventTypeService } from './event-type.service';
import { CreateEventTypeDto, UpdateEventTypeDto } from './dto';

@Controller('event-types')
export class EventTypeController {
  constructor(private readonly eventTypeService: EventTypeService) {}

  @Get()
  findAll() {
    return this.eventTypeService.findAll();
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.eventTypeService.findBySlug(slug);
  }

  @Post()
  create(@Body() dto: CreateEventTypeDto) {
    return this.eventTypeService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventTypeDto) {
    return this.eventTypeService.update(id, dto);
  }
}

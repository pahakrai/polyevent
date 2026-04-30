import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TimeslotService } from './timeslot.service';
import { CreateTimeslotDto, BulkCreateTimeslotDto, UpdateTimeslotDto } from './dto';

@Controller()
export class TimeslotController {
  constructor(private readonly timeslotService: TimeslotService) {}

  @Post('venues/:venueId/timeslots')
  create(@Param('venueId') venueId: string, @Body() dto: CreateTimeslotDto) {
    return this.timeslotService.create({ ...dto, venueId });
  }

  @Post('venues/:venueId/timeslots/bulk')
  createBulk(@Param('venueId') venueId: string, @Body() dto: BulkCreateTimeslotDto) {
    return this.timeslotService.createBulk({ ...dto, venueId });
  }

  @Get('venues/:venueId/timeslots')
  findByVenueId(
    @Param('venueId') venueId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.timeslotService.findByVenueId(venueId, startDate, endDate);
  }

  @Get('timeslots/:id')
  findById(@Param('id') id: string) {
    return this.timeslotService.findById(id);
  }

  @Patch('timeslots/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTimeslotDto) {
    return this.timeslotService.update(id, dto);
  }

  @Delete('timeslots/:id')
  remove(@Param('id') id: string) {
    return this.timeslotService.remove(id);
  }

  @Post('timeslots/:id/block')
  block(@Param('id') id: string) {
    return this.timeslotService.block(id);
  }
}

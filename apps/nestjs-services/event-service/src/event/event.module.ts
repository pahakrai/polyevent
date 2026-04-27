import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventSearchController } from './event-search.controller';

@Module({
  controllers: [EventController, EventSearchController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}

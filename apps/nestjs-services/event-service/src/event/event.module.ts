import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisClient } from '@polydom/database-client';
import { EventTypeModule } from '../event-type/event-type.module';
import { EventTypeService } from '../event-type/event-type.service';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventSearchController } from './event-search.controller';

@Module({
  imports: [ConfigModule, EventTypeModule],
  controllers: [EventController, EventSearchController],
  providers: [
    EventService,
    {
      provide: RedisClient,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
          return null; // Redis is optional — service falls back gracefully
        }
        const client = new RedisClient({ url: redisUrl });
        client.connect().catch(() => {});
        return client;
      },
    },
  ],
  exports: [EventService],
})
export class EventModule {}

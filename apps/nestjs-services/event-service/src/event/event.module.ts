import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisClient, REDIS_CLIENT_CONFIG } from '@polydom/database-client';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventSearchController } from './event-search.controller';

@Module({
  imports: [ConfigModule],
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

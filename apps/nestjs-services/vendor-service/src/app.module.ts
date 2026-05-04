import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NatsModule } from '@polydom/nats-client';
import { HealthController } from './health.controller';
import { VendorModule } from './vendor/vendor.module';
import { VenueModule } from './venue/venue.module';
import { TimeslotModule } from './timeslot/timeslot.module';

const imports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '../../../.env'],
  }),
  VendorModule,
  VenueModule,
  TimeslotModule,
];

if (process.env.NATS_SERVERS) {
  imports.push(
    NatsModule.register({
      servers: process.env.NATS_SERVERS.split(','),
      producer: true,
    }),
  );
}

@Module({
  imports,
  controllers: [HealthController],
})
export class AppModule {}

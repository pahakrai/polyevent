import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { VendorModule } from './vendor/vendor.module';
import { VenueModule } from './venue/venue.module';
import { TimeslotModule } from './timeslot/timeslot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../.env'],
    }),
    VendorModule,
    VenueModule,
    TimeslotModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

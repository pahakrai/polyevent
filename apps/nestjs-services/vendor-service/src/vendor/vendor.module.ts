import { Module } from '@nestjs/common';
import { JwtAuthModule } from '@polydom/auth';
import { VendorController } from './vendor.controller';
import { VendorInternalController } from './vendor-internal.controller';
import { VendorService } from './vendor.service';

@Module({
  imports: [
    JwtAuthModule.forRoot({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    }),
  ],
  controllers: [VendorController, VendorInternalController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}

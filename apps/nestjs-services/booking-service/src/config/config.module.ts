import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { AdminConfigController } from './admin-config.controller';

@Module({
  controllers: [AdminConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

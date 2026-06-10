import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { AdminConfigController } from './admin-config.controller';

@Global()
@Module({
  controllers: [AdminConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

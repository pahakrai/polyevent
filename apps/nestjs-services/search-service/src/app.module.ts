import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchModule } from './search/search.module';
import { HealthController } from './health.controller';

const imports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '../../../.env'],
  }),
  SearchModule,
];

@Module({
  imports,
  controllers: [HealthController],
})
export class AppModule {}

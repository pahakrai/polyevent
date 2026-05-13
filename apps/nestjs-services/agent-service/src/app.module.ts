import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health.controller';
import { AgentModule } from './agent/agent.module';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../.env'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url:
            configService.get<string>('REDIS_URL') ||
            'redis://localhost:6379',
        },
      }),
    }),
    AgentModule,
    KnowledgeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

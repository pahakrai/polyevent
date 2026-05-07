import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthModule } from '@polydom/auth';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { EmbeddingService } from './embedding.service';
import { AnthropicProvider } from '../agent/anthropic-provider';

@Module({
  imports: [
    ConfigModule,
    JwtAuthModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'dev-secret',
        expiresIn: '7d',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, EmbeddingService, AnthropicProvider],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}

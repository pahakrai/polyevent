import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { EmbeddingService } from './embedding.service';
import { AnthropicProvider } from '../agent/anthropic-provider';

@Module({
  imports: [ConfigModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, EmbeddingService, AnthropicProvider],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}

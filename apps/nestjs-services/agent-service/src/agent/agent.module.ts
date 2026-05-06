import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { McpModule } from '../mcp/mcp.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentController } from './agent.controller';
import { InvestigationService } from './investigation.service';
import { ToolExecutorService } from './tool-executor.service';
import { AnthropicProvider } from './anthropic-provider';
import { BusinessSkillsProvider } from './skills/business-skills.provider';

@Module({
  imports: [ConfigModule, McpModule, KnowledgeModule],
  controllers: [AgentController],
  providers: [
    // Core
    InvestigationService,
    ToolExecutorService,
    // LLM provider (Anthropic SDK -> DeepSeek API)
    AnthropicProvider,
    // Business rules (textbook — injected into system prompt)
    BusinessSkillsProvider,
  ],
  exports: [InvestigationService, ToolExecutorService],
})
export class AgentModule {}

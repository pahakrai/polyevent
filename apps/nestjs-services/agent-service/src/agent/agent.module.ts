import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { McpModule } from '../mcp/mcp.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentController } from './agent.controller';
import { InvestigationService } from './investigation.service';
import { InvestigationQueue } from './investigation-queue.service';
import { AgentWorkerProcessor } from './agent-worker.processor';
import { ToolExecutorService } from './tool-executor.service';
import { SessionStore } from './session-store.service';
import { InvestigationEventBus } from './investigation-event.bus';
import { AnthropicProvider } from './anthropic-provider';
import { BusinessSkillsProvider } from './skills/business-skills.provider';
import { McpClientFactory } from '../mcp/mcp-client.factory';

@Module({
  imports: [
    ConfigModule,
    McpModule,
    KnowledgeModule,
    BullModule.registerQueue({ name: 'investigation-queue' }),
  ],
  controllers: [AgentController],
  providers: [
    // Core
    InvestigationService,
    ToolExecutorService,
    // Queue
    InvestigationQueue,
    AgentWorkerProcessor,
    // Session
    SessionStore,
    // MCP per-investigation factory
    McpClientFactory,
    // LLM
    AnthropicProvider,
    // Business rules
    BusinessSkillsProvider,
    // Real-time (SSE)
    InvestigationEventBus,
  ],
  exports: [InvestigationService, ToolExecutorService],
})
export class AgentModule {}

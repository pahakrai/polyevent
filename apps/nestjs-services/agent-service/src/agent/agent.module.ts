import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentController } from './agent.controller';
import { InvestigationService } from './investigation.service';
import { ToolExecutorService } from './tool-executor.service';
import { DeepSeekProvider } from './deepseek-provider';
import { AnthropicProvider } from './anthropic-provider';
import { IntrospectionSkill } from './skills/introspection.skill';
import { ValidationSkill } from './skills/validation.skill';
import { BusinessAnalystSkill } from './skills/business-analyst.skill';
import { SkillRegistryService } from './skills/skill-registry.service';

@Module({
  imports: [ConfigModule],
  controllers: [AgentController],
  providers: [
    // Core
    InvestigationService,
    ToolExecutorService,
    // LLM providers
    DeepSeekProvider,
    AnthropicProvider,
    // Skills (Skill-in-the-Middle pipeline)
    IntrospectionSkill,
    ValidationSkill,
    BusinessAnalystSkill,
    SkillRegistryService,
  ],
  exports: [InvestigationService, SkillRegistryService],
})
export class AgentModule {}

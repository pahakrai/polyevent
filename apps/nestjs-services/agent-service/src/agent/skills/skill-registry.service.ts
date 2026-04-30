import { Injectable, Logger } from '@nestjs/common';
import type { Skill, SkillContext, SkillCategory } from './skill.interface';
import type { ToolDefinition } from '../tools';
import { ALL_TOOLS } from '../tools';
import { IntrospectionSkill } from './introspection.skill';
import { ValidationSkill } from './validation.skill';
import { BusinessAnalystSkill } from './business-analyst.skill';

/**
 * Central registry of all Skills.
 *
 * Responsibilities:
 *   1. Register skills and their tools
 *   2. Provide the combined tool list to the LLM (via getLlmTools)
 *   3. Route tool execution to the owning skill
 *   4. Generate the skill workflow description for the SYSTEM_PROMPT
 */
@Injectable()
export class SkillRegistryService {
  private readonly logger = new Logger(SkillRegistryService.name);
  private readonly skills: Skill[] = [];
  private readonly toolToSkill = new Map<string, Skill>();

  constructor(
    introspection: IntrospectionSkill,
    validation: ValidationSkill,
    businessAnalyst: BusinessAnalystSkill,
  ) {
    this.register(introspection);
    this.register(validation);
    this.register(businessAnalyst);
    this.logger.log(`Registered ${this.skills.length} skills with ${this.toolToSkill.size} tools`);
  }

  private register(skill: Skill) {
    this.skills.push(skill);
    for (const tool of skill.tools) {
      if (this.toolToSkill.has(tool.name)) {
        this.logger.warn(`Tool "${tool.name}" already registered — overwriting`);
      }
      this.toolToSkill.set(tool.name, skill);
    }
  }

  /** Get the flat tool list for the LLM function-calling interface */
  getLlmTools(): ToolDefinition[] {
    return ALL_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  /** Get tools grouped by category (for debugging / UI) */
  getToolsByCategory(): Record<SkillCategory, string[]> {
    const grouped: Record<SkillCategory, string[]> = {
      introspection: [],
      validation: [],
      analysis: [],
      reporting: [],
    };
    for (const skill of this.skills) {
      grouped[skill.category] = skill.tools.map((t) => t.name);
    }
    return grouped;
  }

  /** Route a tool call to the owning skill and execute it */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: SkillContext,
  ): Promise<string> {
    const skill = this.toolToSkill.get(toolName);
    if (!skill) {
      return JSON.stringify({
        error: `Unknown tool: ${toolName}`,
        available: [...this.toolToSkill.keys()],
      });
    }

    this.logger.log(
      `Routing ${toolName} → skill "${skill.name}" (${skill.category})`,
    );

    return skill.execute(toolName, args, context);
  }

  /**
   * Generate the skill workflow description injected into the SYSTEM_PROMPT.
   * This tells the LLM HOW to use the skills in the right order.
   */
  getWorkflowPrompt(): string {
    const lines: string[] = [];

    lines.push('## Available Skills & Workflow');
    lines.push('');
    lines.push('You have access to 3 skill layers. Use them in this order:');
    lines.push('');

    for (const skill of this.skills) {
      const phaseNum =
        skill.category === 'introspection' ? 1 :
        skill.category === 'validation' ? 2 :
        skill.category === 'analysis' ? 3 : 4;

      lines.push(`### Phase ${phaseNum}: ${skill.name} (${skill.id})`);
      lines.push(skill.description);
      lines.push('');
      lines.push('Available tools:');
      for (const tool of skill.tools) {
        lines.push(`  - **${tool.name}**: ${tool.description.split('.')[0]}.`);
      }
      lines.push('');
    }

    lines.push('### Phase 4: Final Report');
    lines.push('After gathering sufficient data, synthesize your findings into a clear report.');
    lines.push('The report must include: root cause, supporting data, and actionable recommendations.');
    lines.push('');

    return lines.join('\n');
  }
}

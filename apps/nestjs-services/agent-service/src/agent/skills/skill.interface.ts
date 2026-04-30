/**
 * Skill-in-the-Middle framework: types shared across all skills.
 *
 * Architecture:
 *   LLM (function calling) → Skill Registry → Skill Executor → MCP / DB
 *
 * Each Skill is a curated set of tools belonging to one workflow phase.
 * The registry categorizes tools so the LLM knows which phase each tool
 * belongs to. The executor routes tool calls to the owning skill.
 */

export type SkillCategory = 'introspection' | 'validation' | 'analysis' | 'reporting';

export interface SkillToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Which workflow phase this tool belongs to */
  category: SkillCategory;
  /** Safe tools can run without vendor confirmation (read-only, metadata-only) */
  safeAutoExecute: boolean;
}

export interface SkillContext {
  vendorId: string;
  sessionId: string;
}

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly category: SkillCategory;
  /** Shown to the LLM in the system prompt to explain WHEN to use this skill */
  readonly description: string;
  /** Tools this skill provides */
  readonly tools: SkillToolDefinition[];

  /** Execute a tool call owned by this skill */
  execute(toolName: string, args: Record<string, unknown>, context: SkillContext): Promise<string>;
}

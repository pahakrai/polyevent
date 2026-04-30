import { Injectable, Logger } from '@nestjs/common';
import type { Skill, SkillContext } from './skill.interface';
import { VALIDATION_TOOLS } from '../tools';
import { ToolExecutorService } from '../tool-executor.service';

/**
 * Query validation skill — the "Safety Guard" role.
 *
 * Allows the LLM to EXPLAIN a business tool's query plan before executing it.
 * This checks whether the query would be performant without running it.
 *
 * Security: only explains KNOWN business tools, never arbitrary SQL.
 * This prevents the LLM from probing the database with arbitrary EXPLAIN calls.
 */
@Injectable()
export class ValidationSkill implements Skill {
  readonly id = 'validation';
  readonly name = 'Query Validation';
  readonly category = 'validation' as const;
  readonly description =
    'Use explain_tool to check the query plan of a business tool before running it. ' +
    'This validates performance without executing the query.';
  readonly tools = VALIDATION_TOOLS;

  private readonly logger = new Logger(ValidationSkill.name);

  constructor(private readonly toolExecutor: ToolExecutorService) {}

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: SkillContext,
  ): Promise<string> {
    if (toolName !== 'explain_tool') {
      return JSON.stringify({ error: `Unknown validation tool: ${toolName}` });
    }

    const targetTool = args.tool_name as string;
    const toolArgs = (args.tool_args as Record<string, unknown>) || {};

    return this.explainTool(targetTool, toolArgs, context.vendorId);
  }

  /** Run EXPLAIN on a known business tool's query */
  private async explainTool(
    targetTool: string,
    toolArgs: Record<string, unknown>,
    vendorId: string,
  ): Promise<string> {
    // Validate it's a known tool — never explain arbitrary SQL
    const validTools = [
      'get_booking_trends',
      'get_event_performance',
      'get_venue_utilization',
      'get_market_comparison',
      'get_revenue_summary',
      'get_event_timeline',
    ];

    if (!validTools.includes(targetTool)) {
      return JSON.stringify({
        error: `Cannot explain unknown tool: ${targetTool}`,
        available_tools: validTools,
        note: 'explain_tool only works with pre-built business analysis tools for security.',
      });
    }

    try {
      // Execute through tool executor which runs EXPLAIN (ANALYZE false)
      const result = await this.toolExecutor.explain(targetTool, toolArgs, vendorId);
      return result;
    } catch (error) {
      this.logger.error(`explain_tool(${targetTool}) failed`, error);
      return JSON.stringify({
        error: `EXPLAIN failed: ${(error as Error).message}`,
        tool: targetTool,
      });
    }
  }
}

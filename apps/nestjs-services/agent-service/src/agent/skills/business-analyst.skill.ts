import { Injectable, Logger } from '@nestjs/common';
import type { Skill, SkillContext } from './skill.interface';
import { BUSINESS_ANALYST_TOOLS } from '../tools';
import { ToolExecutorService } from '../tool-executor.service';

/**
 * Business Analyst skill — the "Specialist" and "Analyst" roles.
 *
 * Wraps 6 pre-built, parameterized, read-only business queries.
 * The LLM picks the right tool + parameters; the server executes
 * the SQL (with RLS for data isolation). The LLM never writes SQL.
 *
 * Tools: get_booking_trends, get_event_performance, get_venue_utilization,
 *        get_market_comparison, get_revenue_summary, get_event_timeline
 */
@Injectable()
export class BusinessAnalystSkill implements Skill {
  readonly id = 'business-analyst';
  readonly name = 'Business Analysis';
  readonly category = 'analysis' as const;
  readonly description =
    'Use these tools to query vendor business data. Each tool is a pre-built, ' +
    'safe, parameterized query. Pick the right tool for the question — never ' +
    'try to write SQL. Start broad (booking_trends) then narrow down.';
  readonly tools = BUSINESS_ANALYST_TOOLS;

  private readonly logger = new Logger(BusinessAnalystSkill.name);

  constructor(private readonly toolExecutor: ToolExecutorService) {}

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: SkillContext,
  ): Promise<string> {
    const validTools = this.tools.map((t) => t.name);

    if (!validTools.includes(toolName)) {
      return JSON.stringify({
        error: `Unknown analysis tool: ${toolName}`,
        available: validTools,
      });
    }

    this.logger.log(
      `Executing ${toolName}(${JSON.stringify(args)}) for vendor ${context.vendorId}`,
    );

    return this.toolExecutor.execute(toolName, args, context.vendorId);
  }
}

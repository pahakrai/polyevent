import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { AnthropicProvider } from './anthropic-provider';
import type { LlmMessage, LlmProvider } from './llm-provider.interface';
import { BusinessSkillsProvider } from './skills/business-skills.provider';
import { ToolExecutorService, ToolContext } from './tool-executor.service';
import type { McpConnection } from '../mcp/mcp-client.factory';
import { VENDOR_INVESTIGATION_TOOLS } from './tools';
import type { ToolDefinition } from './tools';

export interface InvestigationStep {
  id: string;
  stepNumber: number;
  type:
    | 'reasoning'
    | 'tool_call'
    | 'tool_result'
    | 'final_report'
    | 'waiting'
    | 'redirected';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  timestamp: string;
}

export type InvestigationMode = 'auto' | 'manual';

export interface InvestigationSession {
  id: string;
  vendorId: string;
  goal: string;
  mode: InvestigationMode;
  isSuperadmin: boolean;
  steps: InvestigationStep[];
  messages: LlmMessage[];
  status: 'in_progress' | 'waiting_confirmation' | 'completed' | 'cancelled' | 'error';
  cancelled: boolean;
  createdAt: string;
  error?: string;
}

const AGENT_SYSTEM_PROMPT = `You are a senior business intelligence analyst for the Polydom event platform.

Your job is to investigate vendor business questions using a ReAct (Reasoning + Acting) loop.

HOW YOU WORK:
1. **Read Business Skills** — Your system prompt includes the business rules that define how Polydom calculates churn, revenue, retention, etc. Study these definitions before querying data. Wrong definitions = wrong answers.
2. **Introspect Schema** — Use list_tables to see what data is available, then describe_table to verify column names and types.
3. **Validate Queries** — Use explain_tool before running heavy queries to verify they'll be performant.
4. **Analyze Data** — Run the business analyst tools to gather data. Start broad (booking trends) then narrow down (specific events, venues, segments).
5. **Final Report** — When you have sufficient data, synthesize everything into a clear business report.

RULES:
- NEVER skip business rules — read them in the system prompt first
- Never skip introspection — verify schema before querying
- After each tool call, explain what you found and what's next
- If a tool returns empty results, try a different approach
- Format numbers readably: "43% fill rate" not "0.4285714"
- Never make up data — only reference what was returned by tools
- Compare against market benchmarks when available

DATA SCOPE — Unless told otherwise, you are scoped to a single vendor:
- Every data query you make is automatically scoped to the current vendor's data
- The backend enforces vendor isolation — you cannot access other vendors' raw data
- The ONLY tool that spans all vendors is get_market_comparison (anonymized aggregates)
- Do NOT attempt to query data across vendors — the security layer will block it
- If the user asks for cross-vendor analysis, use get_market_comparison only

FINAL REPORT FORMAT:
1. **Executive Summary** (2-3 sentences)
2. **Key Findings** (bullet points with supporting data)
3. **Root Cause Analysis** (why this is happening)
4. **Market Context** (compare against benchmarks)
5. **Recommendations** (specific, prioritized, actionable)`;

@Injectable()
export class InvestigationService {
  private readonly logger = new Logger(InvestigationService.name);
  private readonly llmProvider: LlmProvider;
  private readonly systemPrompt: string;

  constructor(
    configService: ConfigService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly businessSkills: BusinessSkillsProvider,
    anthropicProvider: AnthropicProvider,
  ) {
    this.llmProvider = anthropicProvider;
    this.systemPrompt =
      AGENT_SYSTEM_PROMPT + '\n\n' + this.businessSkills.getAllBusinessSkills();
    this.logger.log(
      `InvestigationService initialized (LLM_API_URL=${configService.get<string>('LLM_API_URL') || 'default'})`,
    );
  }

  // ── Session factory ────────────────────────────────────────────────

  createSession(
    vendorId: string,
    goal: string,
    mode: InvestigationMode,
    isSuperadmin: boolean,
  ): InvestigationSession {
    return {
      id: uuid(),
      vendorId,
      goal,
      mode,
      isSuperadmin,
      steps: [],
      messages: [
        { role: 'system', content: this.systemPrompt },
        {
          role: 'user',
          content: `Investigate this question about my business: "${goal}"`,
        },
      ],
      status: 'in_progress',
      cancelled: false,
      createdAt: new Date().toISOString(),
    };
  }

  // ── Tool list (passed to LLM) ───────────────────────────────────────

  getLlmTools(nativeTools: ToolDefinition[]): ToolDefinition[] {
    return [...VENDOR_INVESTIGATION_TOOLS, ...nativeTools];
  }

  // ── Core step logic ─────────────────────────────────────────────────

  /**
   * Run one ReAct step (LLM call + tool execution).
   * Mutates `session` in place. Caller is responsible for persisting.
   * `mcpConnection` is the per-investigation MCP connection.
   * `nativeTools` are the MCP native tools (cached from connection).
   * Returns `true` if the investigation should stop (completed, cancelled, maxed out).
   */
  async runSingleStep(
    session: InvestigationSession,
    mcpConnection: McpConnection,
    nativeTools: ToolDefinition[],
  ): Promise<boolean> {
    if (session.cancelled) {
      session.status = 'cancelled';
      return true;
    }

    const maxLlmCalls = 10;
    const llmCallCount = session.steps.filter(
      (s) => s.type === 'reasoning',
    ).length;
    if (llmCallCount >= maxLlmCalls) {
      session.status = 'completed';
      this.logger.warn(`Investigation ${session.id} hit max LLM calls`);
      return true;
    }

    const llmTools = this.getLlmTools(nativeTools);
    const response = await this.llmProvider.chat(session.messages, llmTools);

    if (session.cancelled) {
      session.status = 'cancelled';
      return true;
    }

    // Record reasoning text
    if (response.text) {
      session.steps.push({
        id: uuid(),
        stepNumber: session.steps.length + 1,
        type: 'reasoning',
        content: response.text,
        timestamp: new Date().toISOString(),
      });
    }

    if (response.toolCalls.length > 0) {
      session.messages.push({
        role: 'assistant',
        content: response.text,
        tool_calls: response.toolCalls,
        ...(response.thinking ? { thinking: response.thinking } : {}),
      });

      for (const tc of response.toolCalls) {
        if (session.cancelled) {
          session.status = 'cancelled';
          return true;
        }

        this.logger.log(
          `[ReAct] Step ${session.steps.length + 1}: ${tc.name}(${JSON.stringify(tc.arguments)})`,
        );

        session.steps.push({
          id: uuid(),
          stepNumber: session.steps.length + 1,
          type: 'tool_call',
          content: `Calling: ${tc.name}`,
          toolName: tc.name,
          toolArgs: tc.arguments,
          timestamp: new Date().toISOString(),
        });

        const ctx: ToolContext = {
          vendorId: session.vendorId,
          isSuperadmin: session.isSuperadmin,
        };
        const result = await this.toolExecutor.execute(
          tc.name,
          tc.arguments,
          ctx,
          mcpConnection,
        );

        session.steps.push({
          id: uuid(),
          stepNumber: session.steps.length + 1,
          type: 'tool_result',
          content: this.summarizeResult(result),
          toolName: tc.name,
          toolResult: result,
          timestamp: new Date().toISOString(),
        });

        session.messages.push({
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        });
      }

      if (session.mode === 'manual') {
        session.status = 'waiting_confirmation';
        session.steps.push({
          id: uuid(),
          stepNumber: session.steps.length + 1,
          type: 'waiting',
          content: 'Ready for next step. Click Continue to proceed.',
          timestamp: new Date().toISOString(),
        });
        return true; // Stop after one step in manual mode
      }

      return false; // Auto mode: continue loop
    } else {
      // No tool calls — final report
      session.messages.push({
        role: 'assistant',
        content: response.text,
      });

      session.steps.push({
        id: uuid(),
        stepNumber: session.steps.length + 1,
        type: 'final_report',
        content: response.text,
        timestamp: new Date().toISOString(),
      });

      session.status = 'completed';
      this.logger.log(`Investigation ${session.id} completed`);
      return true;
    }
  }

  // ── Auto mode: tight loop ───────────────────────────────────────────

  async runAutoLoop(
    session: InvestigationSession,
    mcpConnection: McpConnection,
    nativeTools: ToolDefinition[],
  ): Promise<void> {
    const maxLlmCalls = 10;

    while (
      !session.cancelled &&
      session.steps.filter((s) => s.type === 'reasoning').length <
        maxLlmCalls &&
      session.status === 'in_progress'
    ) {
      try {
        const stopped = await this.runSingleStep(
          session,
          mcpConnection,
          nativeTools,
        );
        if (stopped) break;
      } catch (error) {
        this.logger.error(`Investigation ${session.id} failed`, error);
        session.status = 'error';
        session.error = (error as Error).message;
        session.steps.push({
          id: uuid(),
          stepNumber: session.steps.length + 1,
          type: 'final_report',
          content: `Investigation failed: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    if (session.cancelled) {
      session.status = 'cancelled';
      this.logger.log(`Investigation ${session.id} cancelled`);
    } else if (session.status === 'in_progress') {
      session.status = 'completed';
      this.logger.warn(`Investigation ${session.id} hit max LLM calls`);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private summarizeResult(resultJson: string): string {
    try {
      const parsed = JSON.parse(resultJson);
      if (parsed.error) return `Error: ${parsed.error}`;

      if (Array.isArray(parsed)) {
        const text = parsed
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => {
            try {
              const inner = JSON.parse(c.text);
              if (inner.rows)
                return `${inner.row_count || inner.rows.length} rows returned.`;
              if (inner.tables)
                return `${inner.tables.length} tables found.`;
              if (inner.columns) {
                const dbInfo = inner.found ? ` in ${inner.table_name}` : '';
                return `${inner.columns.length} columns${dbInfo}.`;
              }
              return c.text.slice(0, 200);
            } catch {
              return c.text.slice(0, 200);
            }
          })
          .join(' ');
        return text || 'Tool result received.';
      }

      if (parsed.rows) {
        const count = parsed.row_count || parsed.rows.length;
        return count === 0
          ? 'Query returned no results.'
          : `Returned ${count} rows. Sample: ${JSON.stringify(parsed.rows.slice(0, 3))}`;
      }
      if (parsed.table && parsed.columns) {
        return `Table ${parsed.table}: ${parsed.columns.length} columns.`;
      }
      if (parsed.plan) {
        return `EXPLAIN plan available.`;
      }
      return resultJson.slice(0, 200);
    } catch {
      return resultJson.slice(0, 200);
    }
  }
}

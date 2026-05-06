import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { AnthropicProvider } from './anthropic-provider';
import type { LlmMessage, LlmProvider } from './llm-provider.interface';
import { BusinessSkillsProvider } from './skills/business-skills.provider';
import { ToolExecutorService, ToolContext } from './tool-executor.service';
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
  private readonly sessions = new Map<string, InvestigationSession>();
  private readonly llmProvider: LlmProvider;

  constructor(
    configService: ConfigService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly businessSkills: BusinessSkillsProvider,
    anthropicProvider: AnthropicProvider,
  ) {
    this.llmProvider = anthropicProvider;
    this.logger.log(
      `InvestigationService initialized with AnthropicProvider (LLM_API_URL=${configService.get<string>('LLM_API_URL') || 'default'})`,
    );
  }

  // ── Public API ──────────────────────────────────────────────────────

  /** Start a new investigation. Mode: 'auto' runs full loop async, 'manual' runs one step at a time. */
  startInvestigation(
    vendorId: string,
    goal: string,
    mode: InvestigationMode = 'auto',
    isSuperadmin = false,
  ): InvestigationSession {
    const fullSystemPrompt =
      AGENT_SYSTEM_PROMPT +
      '\n\n' +
      this.businessSkills.getAllBusinessSkills();

    const session: InvestigationSession = {
      id: uuid(),
      vendorId,
      goal,
      mode,
      isSuperadmin,
      steps: [],
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: `Investigate this question about my business: "${goal}"` },
      ],
      status: 'in_progress',
      cancelled: false,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    this.logger.log(`Investigation ${session.id} started [${mode}] for vendor ${vendorId}: "${goal}"`);

    if (mode === 'auto') {
      this.runAutoLoop(session).catch((err) => {
        this.logger.error(`Investigation ${session.id} background loop failed`, err);
        if (session.status === 'in_progress') {
          session.status = 'error';
          session.error = (err as Error).message;
        }
      });
    } else {
      this.runSingleStep(session).catch((err) => {
        this.logger.error(`Investigation ${session.id} step failed`, err);
        session.status = 'error';
        session.error = (err as Error).message;
      });
    }

    return session;
  }

  /** Manual mode: advance one ReAct step (LLM call + tool execution). */
  async continueInvestigation(sessionId: string): Promise<InvestigationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.mode !== 'manual') throw new Error('Continue is only available in manual mode');
    if (session.status === 'completed') throw new Error('Investigation already completed');
    if (session.status === 'cancelled') throw new Error('Investigation was cancelled');

    session.status = 'in_progress';
    await this.runSingleStep(session);
    return session;
  }

  /** Cancel a running investigation. Works for both auto and manual modes. */
  cancelInvestigation(sessionId: string): InvestigationSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status === 'completed') throw new Error('Investigation already completed');
    if (session.status === 'cancelled') throw new Error('Investigation already cancelled');

    session.cancelled = true;
    this.logger.log(`Investigation ${sessionId} cancelled by frontend`);
    return session;
  }

  /** Vendor provides guidance mid-investigation. Works for both modes. */
  redirectInvestigation(sessionId: string, instruction: string): InvestigationSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status === 'completed') throw new Error('Investigation already completed');
    if (session.status === 'cancelled') throw new Error('Investigation was cancelled');

    const step: InvestigationStep = {
      id: uuid(),
      stepNumber: session.steps.length + 1,
      type: 'redirected',
      content: `Vendor redirected: "${instruction}"`,
      timestamp: new Date().toISOString(),
    };
    session.steps.push(step);
    this.logger.log(`Investigation ${sessionId} redirected: "${instruction}"`);

    session.messages.push({
      role: 'user',
      content: `[VENDOR GUIDANCE] ${instruction}. Continue the investigation, taking this into account.`,
    });

    return session;
  }

  getSession(sessionId: string): InvestigationSession | undefined {
    return this.sessions.get(sessionId);
  }

  // ── Tool list (passed to LLM) ───────────────────────────────────────

  /** Build the combined tool list passed to the LLM. */
  private getLlmTools(): ToolDefinition[] {
    return VENDOR_INVESTIGATION_TOOLS;
  }

  // ── Core step logic (shared by both modes) ──────────────────────────

  private async runSingleStep(session: InvestigationSession): Promise<void> {
    if (session.cancelled) {
      session.status = 'cancelled';
      return;
    }

    // Safety: max 10 LLM calls (each LLM call counts as a reasoning step)
    const maxLlmCalls = 10;
    const llmCallCount = session.steps.filter(s => s.type === 'reasoning').length;
    if (llmCallCount >= maxLlmCalls) {
      session.status = 'completed';
      this.logger.warn(`Investigation ${session.id} hit max LLM calls (${maxLlmCalls})`);
      return;
    }

    const llmTools = this.getLlmTools();
    const response = await this.llmProvider.chat(session.messages, llmTools);

    if (session.cancelled) {
      session.status = 'cancelled';
      return;
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
      // Feed assistant message back into conversation
      session.messages.push({
        role: 'assistant',
        content: response.text,
        tool_calls: response.toolCalls,
        ...(response.thinking ? { thinking: response.thinking } : {}),
      });

      for (const tc of response.toolCalls) {
        if (session.cancelled) {
          session.status = 'cancelled';
          return;
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

        // Execute via ToolExecutorService — with vendor scope enforcement
        const ctx: ToolContext = {
          vendorId: session.vendorId,
          isSuperadmin: session.isSuperadmin,
        };
        const result = await this.toolExecutor.execute(tc.name, tc.arguments, ctx);

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
      }
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
    }
  }

  // ── Auto mode: tight loop ───────────────────────────────────────────

  private async runAutoLoop(session: InvestigationSession): Promise<void> {
    const maxLlmCalls = 10;

    while (
      !session.cancelled &&
      session.steps.filter(s => s.type === 'reasoning').length < maxLlmCalls &&
      session.status === 'in_progress'
    ) {
      try {
        await this.runSingleStep(session);
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
      this.logger.warn(`Investigation ${session.id} hit max LLM calls (${maxLlmCalls})`);
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
              if (inner.rows) return `${inner.row_count || inner.rows.length} rows returned.`;
              if (inner.tables) return `${inner.tables.length} tables found.`;
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

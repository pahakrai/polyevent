import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { DeepSeekProvider } from './deepseek-provider';
import { AnthropicProvider } from './anthropic-provider';
import type { LlmMessage, LlmProvider } from './llm-provider.interface';
import { SkillRegistryService } from './skills/skill-registry.service';
import type { SkillContext } from './skills/skill.interface';

export interface InvestigationStep {
  id: string;
  stepNumber: number;
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'final_report' | 'waiting' | 'redirected';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  timestamp: string;
}

export interface InvestigationSession {
  id: string;
  vendorId: string;
  goal: string;
  steps: InvestigationStep[];
  messages: LlmMessage[];
  status: 'in_progress' | 'waiting_confirmation' | 'completed' | 'error';
  createdAt: string;
  error?: string;
}

const BASE_SYSTEM_PROMPT = `You are a business intelligence agent for event vendors on the Polydom platform.

Your job is to investigate the vendor's questions about their business performance using a structured workflow.

RULES:
1. Start with introspection — use list_tables and describe_table to understand the schema first.
2. Validate before heavy queries — use explain_tool to check query performance.
3. Start broad, then narrow down. Get the overall trend first, then dig into specifics.
4. After each tool call, explain what you found and what you're investigating next.
5. When you have enough data to answer the vendor's question, provide a clear final report.
6. The final report should include: root cause, supporting data, and actionable recommendations.
7. Never make up data — if a tool returns empty results, say so.
8. If a tool returns an error, try a different approach.
9. Keep explanations concise. Vendors are business owners, not data analysts.
10. Compare against market averages when available to provide context.
11. If the data doesn't explain the problem, say so honestly rather than forcing a conclusion.
12. Format numbers readably: "43% fill rate" not "0.4285714".`;

@Injectable()
export class InvestigationService {
  private readonly logger = new Logger(InvestigationService.name);
  private readonly sessions = new Map<string, InvestigationSession>();
  private readonly llmProvider: LlmProvider;
  private readonly systemPrompt: string;

  constructor(
    configService: ConfigService,
    private readonly skillRegistry: SkillRegistryService,
    deepseekProvider: DeepSeekProvider,
    anthropicProvider: AnthropicProvider,
  ) {
    const provider = configService.get<string>('LLM_PROVIDER', 'deepseek');
    this.llmProvider = provider === 'anthropic' ? anthropicProvider : deepseekProvider;
    this.systemPrompt = BASE_SYSTEM_PROMPT + '\n\n' + this.skillRegistry.getWorkflowPrompt();
    this.logger.log(`LLM provider: ${provider}`);
  }

  /** Start a new investigation. Runs the first step and returns the session. */
  async startInvestigation(vendorId: string, goal: string): Promise<InvestigationSession> {
    const session: InvestigationSession = {
      id: uuid(),
      vendorId,
      goal,
      steps: [],
      messages: [
        { role: 'system', content: this.systemPrompt },
        {
          role: 'user',
          content: `Investigate this question about my business: "${goal}"`,
        },
      ],
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    this.logger.log(`Investigation ${session.id} started for vendor ${vendorId}: "${goal}"`);

    await this.runStep(session);
    return session;
  }

  /** Continue the investigation after vendor confirmation. Runs one more step. */
  async continueInvestigation(sessionId: string): Promise<InvestigationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status === 'completed') throw new Error('Investigation already completed');

    session.status = 'in_progress';
    await this.runStep(session);
    return session;
  }

  /** Inject vendor guidance and continue. */
  async redirectInvestigation(sessionId: string, instruction: string): Promise<InvestigationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status === 'completed') throw new Error('Investigation already completed');

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

    session.status = 'in_progress';
    await this.runStep(session);
    return session;
  }

  /** Get a session by ID */
  getSession(sessionId: string): InvestigationSession | undefined {
    return this.sessions.get(sessionId);
  }

  // ── Core loop ──────────────────────────────────────────────────────

  private async runStep(session: InvestigationSession): Promise<void> {
    const maxSteps = 10;
    if (session.steps.length >= maxSteps) {
      session.status = 'completed';
      const final: InvestigationStep = {
        id: uuid(),
        stepNumber: session.steps.length + 1,
        type: 'final_report',
        content: 'Investigation reached maximum steps. Please review the findings above.',
        timestamp: new Date().toISOString(),
      };
      session.steps.push(final);
      return;
    }

    try {
      const llmTools = this.skillRegistry.getLlmTools();

      // Call LLM with current message history and skill tools
      const response = await this.llmProvider.chat(session.messages, llmTools);

      // If LLM returned reasoning text, record it
      if (response.text) {
        const reasoningStep: InvestigationStep = {
          id: uuid(),
          stepNumber: session.steps.length + 1,
          type: 'reasoning',
          content: response.text,
          timestamp: new Date().toISOString(),
        };
        session.steps.push(reasoningStep);
      }

      // If LLM wants to call tools, record and execute them through SkillRegistry
      if (response.toolCalls.length > 0) {
        session.messages.push({
          role: 'assistant',
          content: response.text,
          tool_calls: response.toolCalls,
        });

        const skillContext: SkillContext = {
          vendorId: session.vendorId,
          sessionId: session.id,
        };

        for (const tc of response.toolCalls) {
          this.logger.log(`Step ${session.steps.length + 1}: ${tc.name}(${JSON.stringify(tc.arguments)})`);

          // Record the tool call step
          const callStep: InvestigationStep = {
            id: uuid(),
            stepNumber: session.steps.length + 1,
            type: 'tool_call',
            content: `Querying: ${tc.name}`,
            toolName: tc.name,
            toolArgs: tc.arguments,
            timestamp: new Date().toISOString(),
          };
          session.steps.push(callStep);

          // Execute via Skill Registry — routes to the right skill
          const result = await this.skillRegistry.execute(
            tc.name,
            tc.arguments,
            skillContext,
          );

          // Record the tool result step
          const resultStep: InvestigationStep = {
            id: uuid(),
            stepNumber: session.steps.length + 1,
            type: 'tool_result',
            content: this.summarizeResult(result),
            toolName: tc.name,
            toolResult: result,
            timestamp: new Date().toISOString(),
          };
          session.steps.push(resultStep);

          // Feed tool result back to LLM
          session.messages.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
          });
        }

        // After executing tools, pause for vendor confirmation
        session.status = 'waiting_confirmation';

        if (session.steps.length < maxSteps) {
          const waitingStep: InvestigationStep = {
            id: uuid(),
            stepNumber: session.steps.length + 1,
            type: 'waiting',
            content: 'Ready for next step. Click Continue or provide redirection.',
            timestamp: new Date().toISOString(),
          };
          session.steps.push(waitingStep);
        }
      } else {
        // No tool calls — this is the final answer
        session.messages.push({
          role: 'assistant',
          content: response.text,
        });

        const finalStep: InvestigationStep = {
          id: uuid(),
          stepNumber: session.steps.length + 1,
          type: 'final_report',
          content: response.text,
          timestamp: new Date().toISOString(),
        };
        session.steps.push(finalStep);
        session.status = 'completed';
        this.logger.log(`Investigation ${session.id} completed`);
      }
    } catch (error) {
      this.logger.error(`Step failed for session ${session.id}`, error);
      session.status = 'error';
      session.error = (error as Error).message;
      const errorStep: InvestigationStep = {
        id: uuid(),
        stepNumber: session.steps.length + 1,
        type: 'final_report',
        content: `Investigation failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      };
      session.steps.push(errorStep);
    }
  }

  private summarizeResult(resultJson: string): string {
    try {
      const parsed = JSON.parse(resultJson);
      if (parsed.error) return `Error: ${parsed.error}`;
      if (parsed.rows) {
        const count = parsed.row_count || parsed.rows.length;
        if (count === 0) return 'Query returned no results.';
        const preview = parsed.rows.slice(0, 3);
        return `Returned ${count} rows. Sample: ${JSON.stringify(preview)}`;
      }
      if (parsed.vendor_db || parsed.event_db) {
        // Introspection result
        const vCount = parsed.vendor_db?.length || 0;
        const eCount = parsed.event_db?.length || 0;
        return `Schema discovery: ${vCount} tables in vendor_db, ${eCount} tables in event_db.`;
      }
      if (parsed.table && parsed.columns) {
        return `Table ${parsed.table}: ${parsed.columns.length} columns.`;
      }
      if (parsed.plan) {
        return `EXPLAIN plan available for ${parsed.tool}.`;
      }
      return resultJson.slice(0, 200);
    } catch {
      return resultJson.slice(0, 200);
    }
  }
}

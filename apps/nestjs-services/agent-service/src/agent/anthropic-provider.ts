import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { LlmMessage, LlmProvider, LlmResponse, LlmToolCall } from './llm-provider.interface';
import type { ToolDefinition } from './tools';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly isDeepSeek: boolean;

  constructor(configService: ConfigService) {
    const baseURL = configService.get<string>('LLM_API_URL') || undefined;
    this.isDeepSeek = baseURL ? baseURL.includes('deepseek') : false;
    this.model = configService.get<string>('LLM_MODEL') || 'claude-opus-4-7';
    this.client = new Anthropic({
      apiKey:
        configService.get<string>('LLM_API_KEY') ||
        configService.get<string>('ANTHROPIC_API_KEY') ||
        'sk-placeholder',
      ...(baseURL ? { baseURL } : {}),
    });
    this.logger.log(
      `AnthropicProvider: model=${this.model}, deepseek=${this.isDeepSeek}, ` +
      `baseURL=${baseURL || 'default'}`,
    );
  }

  async chat(messages: LlmMessage[], tools: ToolDefinition[]): Promise<LlmResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const otherMsgs = messages.filter((m) => m.role !== 'system');

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));

    const anthropicMessages: Anthropic.MessageParam[] = [];
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];

    const flushToolResults = () => {
      if (toolResultBlocks.length > 0) {
        anthropicMessages.push({
          role: 'user',
          content: [...toolResultBlocks],
        });
        toolResultBlocks.length = 0;
      }
    };

    for (const m of otherMsgs) {
      if (m.role === 'tool') {
        toolResultBlocks.push({
          type: 'tool_result' as const,
          tool_use_id: m.tool_call_id!,
          content: m.content,
        });
      } else {
        flushToolResults();
        if (m.role === 'assistant' && m.tool_calls) {
          const blocks: Anthropic.ContentBlock[] = m.tool_calls.map((tc) => ({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          })) as Anthropic.ContentBlock[];
          if (m.thinking) {
            blocks.unshift({ type: 'thinking', thinking: m.thinking } as Anthropic.ContentBlock);
          }
          anthropicMessages.push({ role: 'assistant', content: blocks });
        } else {
          anthropicMessages.push({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          });
        }
      }
    }
    flushToolResults();

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 64000,
        ...(this.isDeepSeek
          ? { thinking: { type: 'disabled' as const } }
          : {
              thinking: { type: 'adaptive' as const, display: 'summarized' as const },
              output_config: { effort: 'xhigh' as 'high' | 'max' },
              cache_control: { type: 'ephemeral' as const },
            }),
        system: systemMsg?.content,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      const response = await stream.finalMessage();

      const toolCalls: LlmToolCall[] = [];
      let text = '';
      let thinking = '';

      for (const block of response.content) {
        if (block.type === 'text') {
          text += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        } else if (block.type === 'thinking') {
          if (block.thinking) {
            thinking += block.thinking;
            this.logger.debug(`Claude thinking: ${block.thinking.slice(0, 200)}...`);
          }
        }
      }

      const stopReason: LlmResponse['stopReason'] =
        response.stop_reason === 'end_turn' || response.stop_reason === 'tool_use'
          ? response.stop_reason
          : response.stop_reason === 'refusal'
            ? 'end_turn'
            : 'max_tokens';

      this.logger.log(
        `Claude: stop=${response.stop_reason}, tools=${toolCalls.length}, ` +
        `input=${response.usage.input_tokens}, output=${response.usage.output_tokens}, ` +
        `cache_read=${response.usage.cache_read_input_tokens ?? 0}, ` +
        `cache_write=${response.usage.cache_creation_input_tokens ?? 0}`,
      );

      return { text, toolCalls, stopReason, ...(thinking ? { thinking } : {}) };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        this.logger.error('Anthropic rate limited — retry after backoff');
      } else if (error instanceof Anthropic.APIError) {
        this.logger.error(`Anthropic API error ${error.status}: ${error.message}`);
      } else {
        this.logger.error('Unexpected error calling Anthropic', error as Error);
      }
      throw error;
    }
  }
}

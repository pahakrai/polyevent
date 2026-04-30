import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { LlmMessage, LlmProvider, LlmResponse, LlmToolCall } from './llm-provider.interface';
import type { ToolDefinition } from './tools';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic;

  constructor(configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: configService.get<string>('ANTHROPIC_API_KEY') || 'sk-placeholder',
    });
  }

  async chat(messages: LlmMessage[], tools: ToolDefinition[]): Promise<LlmResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const otherMsgs = messages.filter((m) => m.role !== 'system');

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));

    const anthropicMessages: Anthropic.MessageParam[] = otherMsgs.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: m.tool_call_id!,
              content: m.content,
            },
          ],
        };
      }
      if (m.role === 'assistant' && m.tool_calls) {
        return {
          role: 'assistant',
          content: m.tool_calls.map((tc) => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          })),
        };
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
    });

    try {
      const stream = this.client.messages.stream({
        model: 'claude-opus-4-7',
        max_tokens: 64000,
        thinking: { type: 'adaptive', display: 'summarized' },
        // xhigh is valid at runtime on Opus 4.7; SDK types haven't caught up
        output_config: { effort: 'xhigh' as 'high' | 'max' },
        cache_control: { type: 'ephemeral' },
        system: systemMsg?.content,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      const response = await stream.finalMessage();

      const toolCalls: LlmToolCall[] = [];
      let text = '';

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

      return { text, toolCalls, stopReason };
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

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, tool, jsonSchema } from 'ai';
import type { ModelMessage } from 'ai';
import type { LlmMessage, LlmProvider, LlmResponse, LlmToolCall } from './llm-provider.interface';
import type { ToolDefinition } from './tools';

@Injectable()
export class DeepSeekProvider implements LlmProvider {
  private readonly logger = new Logger(DeepSeekProvider.name);
  private readonly model: ReturnType<ReturnType<typeof createDeepSeek>>;

  constructor(configService: ConfigService) {
    const apiKey =
      configService.get<string>('DEEPSEEK_API_KEY') ||
      configService.get<string>('LLM_API_KEY') ||
      'sk-placeholder';

    const deepseek = createDeepSeek({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });

    this.model = deepseek('deepseek-chat');
    this.logger.log('DeepSeek provider initialized with @ai-sdk/deepseek');
  }

  async chat(messages: LlmMessage[], tools: ToolDefinition[]): Promise<LlmResponse> {
    const aiTools: Record<string, ReturnType<typeof tool>> = {};
    for (const t of tools) {
      aiTools[t.name] = tool({
        description: t.description,
        inputSchema: jsonSchema(t.input_schema as Record<string, unknown>),
      });
    }

    const aiMessages = messages.map((m) => this.convertMessage(m));

    try {
      const result = await generateText({
        model: this.model,
        messages: aiMessages,
        tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
        temperature: 0.3,
      });

      const toolCalls: LlmToolCall[] = (result.toolCalls || []).map((tc) => ({
        id: tc.toolCallId,
        name: tc.toolName,
        arguments: tc.input as Record<string, unknown>,
      }));

      this.logger.log(
        `DeepSeek: finish=${result.finishReason}, tools=${toolCalls.length}, ` +
        `usage=${JSON.stringify(result.usage)}`,
      );

      return {
        text: result.text || '',
        toolCalls,
        stopReason:
          toolCalls.length > 0 ? 'tool_use' :
          result.finishReason === 'stop' ? 'end_turn' :
          'max_tokens',
      };
    } catch (error) {
      this.logger.error('DeepSeek API call failed', error as Error);
      throw error;
    }
  }

  private convertMessage(m: LlmMessage): ModelMessage {
    switch (m.role) {
      case 'system':
        return { role: 'system', content: m.content };

      case 'user':
        return { role: 'user', content: m.content };

      case 'assistant': {
        if (m.tool_calls && m.tool_calls.length > 0) {
          return {
            role: 'assistant',
            content: [
              ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
              ...m.tool_calls.map((tc) => ({
                type: 'tool-call' as const,
                toolCallId: tc.id,
                toolName: tc.name,
                input: tc.arguments,
              })),
            ],
          };
        }
        return { role: 'assistant', content: m.content };
      }

      case 'tool':
        return {
          role: 'tool',
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: m.tool_call_id!,
              toolName: '',
              output: { type: 'text' as const, value: m.content },
            },
          ],
        };
    }
  }
}

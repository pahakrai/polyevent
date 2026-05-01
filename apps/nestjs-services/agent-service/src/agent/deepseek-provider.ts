import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { LlmMessage, LlmProvider, LlmResponse, LlmToolCall } from './llm-provider.interface';
import type { ToolDefinition } from './tools';

@Injectable()
export class DeepSeekProvider implements LlmProvider {
  private readonly logger = new Logger(DeepSeekProvider.name);
  private readonly client: OpenAI;

  constructor(configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: configService.get<string>('DEEPSEEK_API_KEY') || 'sk-placeholder',
      baseURL: 'https://api.deepseek.com',
    });
  }

  async chat(messages: LlmMessage[], tools: ToolDefinition[]): Promise<LlmResponse> {
    const openaiTools = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const typedMessages = messages.map((m) => {
      switch (m.role) {
        case 'system':
          return { role: 'system' as const, content: m.content };
        case 'user':
          return { role: 'user' as const, content: m.content };
        case 'assistant':
          return {
            role: 'assistant' as const,
            content: m.content || null,
            ...(m.tool_calls
              ? {
                  tool_calls: m.tool_calls.map((tc) => ({
                    id: tc.id,
                    type: 'function' as const,
                    function: {
                      name: tc.name,
                      arguments: JSON.stringify(tc.arguments),
                    },
                  })),
                }
              : {}),
          };
        case 'tool':
          return {
            role: 'tool' as const,
            content: m.content,
            tool_call_id: m.tool_call_id!,
          };
      }
    });

    const response = await this.client.chat.completions.create({
      model: 'deepseek-flash',
      messages: typedMessages,
      tools: openaiTools,
      temperature: 0.3,
    });

    const choice = response.choices[0];
    const msg = choice.message;

    const toolCalls: LlmToolCall[] = (msg.tool_calls || []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    this.logger.log(
      `DeepSeek: stop=${choice.finish_reason}, tools=${toolCalls.length}, tokens=${response.usage?.total_tokens}`,
    );

    return {
      text: msg.content || '',
      toolCalls,
      stopReason:
        choice.finish_reason === 'tool_calls'
          ? 'tool_use'
          : choice.finish_reason === 'stop'
            ? 'end_turn'
            : 'max_tokens',
    };
  }
}

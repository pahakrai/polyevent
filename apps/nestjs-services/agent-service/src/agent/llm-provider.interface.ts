import type { ToolDefinition } from './tools';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: LlmToolCall[];
  thinking?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  thinking?: string;
}

export interface LlmProvider {
  chat(
    messages: LlmMessage[],
    tools: ToolDefinition[],
  ): Promise<LlmResponse>;
}

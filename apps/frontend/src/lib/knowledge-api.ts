import { api } from './api';

export interface DocumentRecord {
  id: string;
  title: string;
  content_type: string;
  created_by: string;
  created_at: string;
}

export interface ChatResult {
  answer: string;
  sources: { chunk: string; similarity: number }[];
}

export async function chat(question: string): Promise<ChatResult> {
  const { data } = await api.post('/agent/chat', { question });
  return data;
}

export async function chatStream(
  question: string,
  onToken: (token: string) => void,
  onSources: (sources: ChatResult['sources']) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      onError(`HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          switch (eventType) {
            case 'token':
              onToken(data);
              break;
            case 'sources':
              try {
                onSources(JSON.parse(data));
              } catch {
                // ignore parse errors
              }
              break;
            case 'done':
              onDone();
              return;
            case 'error':
              onError(data);
              return;
          }
        }
      }
    }

    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Stream failed');
  }
}

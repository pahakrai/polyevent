import { api } from './api';

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
  sessionId: string;
  status: 'in_progress' | 'waiting_confirmation' | 'completed' | 'error';
  steps: InvestigationStep[];
  error?: string;
  createdAt: string;
}

export async function startInvestigation(goal: string, vendorId: string): Promise<InvestigationSession> {
  const { data } = await api.post('/agent/investigate', { goal, vendorId });
  return data;
}

export async function continueInvestigation(sessionId: string): Promise<InvestigationSession> {
  const { data } = await api.post(`/agent/investigate/${sessionId}/continue`);
  return data;
}

export async function redirectInvestigation(sessionId: string, instruction: string): Promise<InvestigationSession> {
  const { data } = await api.post(`/agent/investigate/${sessionId}/redirect`, { instruction });
  return data;
}

export async function getSession(sessionId: string): Promise<InvestigationSession> {
  const { data } = await api.get(`/agent/investigate/${sessionId}`);
  return data;
}

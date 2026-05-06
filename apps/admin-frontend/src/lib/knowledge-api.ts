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

export async function uploadDocument(
  file: File,
  title: string,
  createdBy: string,
): Promise<DocumentRecord> {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  form.append('createdBy', createdBy);

  const { data } = await api.post('/agent/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const { data } = await api.get('/agent/documents');
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/agent/documents/${id}`);
}

export async function chat(question: string): Promise<ChatResult> {
  const { data } = await api.post('/agent/chat', { question });
  return data;
}

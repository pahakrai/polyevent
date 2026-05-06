import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import * as pg from 'pg';
import { EmbeddingService } from './embedding.service';
import { AnthropicProvider } from '../agent/anthropic-provider';
import type { LlmMessage } from '../agent/llm-provider.interface';

export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  content_type: string;
  chunks: string[];
  created_by: string;
  created_at: string;
}

export interface ChatResult {
  answer: string;
  sources: { chunk: string; similarity: number }[];
}

const RAG_SYSTEM_PROMPT = `You are a helpful knowledge base assistant for the Polydom event platform.
Answer questions using ONLY the provided document excerpts. If the excerpts don't contain the answer, say "I don't find that information in the knowledge base." Do not make up information.

Rules:
- Cite which document excerpt(s) you used
- Be concise and direct
- If the question is about policies or rules, quote the exact text when helpful`;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private pool: pg.Pool;

  constructor(
    configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
    private readonly llmProvider: AnthropicProvider,
  ) {
    this.pool = new pg.Pool({
      connectionString:
        configService.get<string>('AGENT_DATABASE_URL') ||
        'postgresql://eventbooking:eventbooking123@localhost:5432/agent_db',
    });
  }

  // ── Text chunking ────────────────────────────────────────────────────

  /** Split text into overlapping chunks, targeting ~500 chars each on paragraph boundaries. */
  chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let current = '';

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (current.length + trimmed.length > chunkSize && current.length > 0) {
        chunks.push(current.trim());
        // Overlap: keep last `overlap` chars of previous chunk
        const overlapText = current.slice(Math.max(0, current.length - overlap));
        current = overlapText + '\n\n' + trimmed;
      } else {
        current = current ? current + '\n\n' + trimmed : trimmed;
      }

      // If a single paragraph exceeds chunkSize, split it
      while (current.length > chunkSize * 1.5) {
        const splitPoint = current.lastIndexOf(' ', chunkSize);
        const cut = splitPoint > 0 ? splitPoint : chunkSize;
        chunks.push(current.slice(0, cut).trim());
        current = current.slice(Math.max(0, cut - overlap)).trim();
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text.slice(0, chunkSize)];
  }

  // ── Document parsing ─────────────────────────────────────────────────

  async parseDocument(buffer: Buffer, contentType: string): Promise<string> {
    if (contentType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      return result.text;
    }

    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    // Plain text / markdown
    return buffer.toString('utf-8');
  }

  // ── Ingest ───────────────────────────────────────────────────────────

  async ingestDocument(
    title: string,
    rawContent: string,
    contentType: string,
    createdBy: string,
  ): Promise<DocumentRecord> {
    const chunks = this.chunkText(rawContent);
    this.logger.log(`Ingesting "${title}": ${chunks.length} chunks`);

    let embedding: number[];
    try {
      // Embed the first chunk as the document-level embedding
      embedding = await this.embeddingService.embed(chunks[0].slice(0, 512));
    } catch (err) {
      this.logger.error('Embedding failed, using zero vector fallback', err as Error);
      embedding = new Array(384).fill(0);
    }

    const id = uuid();
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO documents (id, title, content, content_type, chunks, embedding, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector, $7, NOW())`,
        [id, title, rawContent, contentType, JSON.stringify(chunks), `[${embedding.join(',')}]`, createdBy],
      );
    } finally {
      client.release();
    }

    return {
      id,
      title,
      content: rawContent,
      content_type: contentType,
      chunks,
      created_by: createdBy,
      created_at: new Date().toISOString(),
    };
  }

  // ── List / Delete ────────────────────────────────────────────────────

  async listDocuments(): Promise<Omit<DocumentRecord, 'content' | 'chunks'>[]> {
    const result = await this.pool.query(
      `SELECT id, title, content_type, created_by, created_at FROM documents ORDER BY created_at DESC`,
    );
    return result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      content_type: r.content_type,
      created_by: r.created_by,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    }));
  }

  async deleteDocument(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM documents WHERE id = $1`, [id]);
  }

  // ── Similarity search ────────────────────────────────────────────────

  async searchSimilar(queryEmbedding: number[], topK = 5): Promise<{ chunk: string; similarity: number }[]> {
    const result = await this.pool.query(
      `SELECT chunks, embedding <=> $1::vector AS distance
       FROM documents
       ORDER BY distance
       LIMIT $2`,
      [`[${queryEmbedding.join(',')}]`, topK],
    );

    const matches: { chunk: string; similarity: number }[] = [];
    for (const row of result.rows) {
      // Find the most similar chunk in each document
      const chunks: string[] = row.chunks || [];
      let bestChunk = '';
      let bestDist = Infinity;

      for (const chunk of chunks) {
        const chunkEmb = await this.embeddingService.embed(chunk.slice(0, 512));
        const dist = this.cosineDistance(queryEmbedding, chunkEmb);
        if (dist < bestDist) {
          bestDist = dist;
          bestChunk = chunk;
        }
      }
      if (bestChunk) {
        matches.push({ chunk: bestChunk, similarity: 1 - bestDist });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  // ── RAG Chat ─────────────────────────────────────────────────────────

  async chat(question: string): Promise<ChatResult> {
    const queryEmbedding = await this.embeddingService.embed(question);
    const sources = await this.searchSimilar(queryEmbedding);

    if (sources.length === 0) {
      return {
        answer: 'No documents found in the knowledge base. Please upload documents first.',
        sources: [],
      };
    }

    const context = sources
      .map((s, i) => `[Excerpt ${i + 1}] ${s.chunk}`)
      .join('\n\n');

    const messages: LlmMessage[] = [
      { role: 'system', content: RAG_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Use the following document excerpts to answer the question.\n\n--- DOCUMENTS ---\n${context}\n\n--- QUESTION ---\n${question}`,
      },
    ];

    const response = await this.llmProvider.chat(messages, []);
    return { answer: response.text, sources };
  }

  private cosineDistance(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

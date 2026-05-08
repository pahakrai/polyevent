import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import * as pg from 'pg';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from 'langchain';
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

/** Format a number array as a pgvector-compatible string (no scientific notation). */
function toVectorString(values: number[]): string {
  return `[${values.map((v) => {
    // Use toFixed(10) to avoid scientific notation, then strip trailing zeros
    const s = v.toFixed(10);
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  }).join(',')}]`;
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
  private textSplitter?: RecursiveCharacterTextSplitter;

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

  private getSplitter(): RecursiveCharacterTextSplitter {
    this.textSplitter ??= new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' ', ''],
    });
    return this.textSplitter;
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

    return buffer.toString('utf-8');
  }

  // ── LangChain chunking ──────────────────────────────────────────────

  async chunkText(text: string): Promise<string[]> {
    const docs = await this.getSplitter().splitDocuments([
      new Document({ pageContent: text }),
    ]);
    return docs.map((d) => d.pageContent);
  }

  // ── Ingest ───────────────────────────────────────────────────────────

  async ingestDocument(
    title: string,
    rawContent: string,
    contentType: string,
    createdBy: string,
  ): Promise<DocumentRecord> {
    const chunks = await this.chunkText(rawContent);
    this.logger.log(`Ingesting "${title}": ${chunks.length} chunks`);

    // Embed all chunks in batch
    let embeddings: number[][];
    try {
      const truncated = chunks.map((c) => c.slice(0, 512));
      embeddings = await this.embeddingService.embedBatch(truncated);
    } catch (err) {
      this.logger.error('Batch embedding failed, using zero vectors', err as Error);
      embeddings = chunks.map(() => new Array(384).fill(0));
    }

    const docId = uuid();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO documents (id, title, content, content_type, chunks, embedding, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector, $7, NOW())`,
        [
          docId,
          title,
          rawContent,
          contentType,
          JSON.stringify(chunks),
          toVectorString(embeddings[0]),
          createdBy,
        ],
      );

      // Store each chunk with its own embedding
      for (let i = 0; i < chunks.length; i++) {
        const vecStr = toVectorString(embeddings[i]);
        this.logger.log(`Chunk ${i} vector sample: ${vecStr.slice(0, 80)}, hasSciNotation=${/e[+-]/.test(vecStr)}`);
        await client.query(
          `INSERT INTO document_chunks (id, document_id, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)`,
          [uuid(), docId, i, chunks[i], vecStr],
        );
      }

      await client.query('COMMIT');
      this.logger.log(`Stored ${chunks.length} chunk embeddings for doc ${docId}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      id: docId,
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
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM document_chunks WHERE document_id = $1`, [id]);
      await client.query(`DELETE FROM documents WHERE id = $1`, [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Similarity search (direct chunk-level) ─────────────────────────

  async searchSimilar(queryEmbedding: number[], topK = 5): Promise<{ chunk: string; similarity: number }[]> {
    const embeddingStr = toVectorString(queryEmbedding);

    const result = await this.pool.query(
      `SELECT dc.content AS chunk, 1 - (dc.embedding <=> '${embeddingStr}'::vector) AS similarity
       FROM document_chunks dc
       ORDER BY similarity
       LIMIT $1`,
      [topK],
    );

    return result.rows.map((r) => ({
      chunk: r.chunk,
      similarity: Number(r.similarity),
    }));
  }

  // ── RAG Chat ─────────────────────────────────────────────────────────

  async chat(question: string): Promise<ChatResult> {
    const queryEmbedding = await this.embeddingService.embed(question);
    this.logger.log(`Chat query embedding: dim=${queryEmbedding.length}, first3=[${queryEmbedding.slice(0, 3).join(',')}], allZero=${queryEmbedding.every(v => v === 0)}`);
    const sources = await this.searchSimilar(queryEmbedding);
    this.logger.log(`Chat sources found: ${sources.length}`);

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

  // ── Streaming Chat ───────────────────────────────────────────────────

  async *chatStream(question: string): AsyncIterable<{ type: 'token' | 'sources' | 'done'; data: string }> {
    const queryEmbedding = await this.embeddingService.embed(question);
    const sources = await this.searchSimilar(queryEmbedding);

    if (sources.length === 0) {
      yield { type: 'token', data: 'No documents found in the knowledge base. Please upload documents first.' };
      yield { type: 'done', data: '' };
      return;
    }

    // Emit sources first so the UI can show them
    yield {
      type: 'sources',
      data: JSON.stringify(sources.map((s) => ({ chunk: s.chunk, similarity: s.similarity }))),
    };

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

    for await (const token of this.llmProvider.chatStream(messages, [])) {
      yield { type: 'token', data: token };
    }

    yield { type: 'done', data: '' };
  }
}

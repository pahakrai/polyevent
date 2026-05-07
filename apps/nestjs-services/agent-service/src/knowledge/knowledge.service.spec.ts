import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from './knowledge.service';
import { EmbeddingService } from './embedding.service';
import { AnthropicProvider } from '../agent/anthropic-provider';

// ── Mock pg Pool ──────────────────────────────────────────────────────
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
});

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    query: mockQuery,
  })),
}));

// ── Mock embedding service ────────────────────────────────────────────
const mockEmbed = jest.fn();
const mockEmbedBatch = jest.fn();

// ── Mock LLM provider ─────────────────────────────────────────────────
const mockLlmChat = jest.fn();
const mockLlmChatStream = jest.fn();

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockEmbed.mockResolvedValue(new Array(384).fill(0.1));
    mockEmbedBatch.mockResolvedValue([
      new Array(384).fill(0.1),
      new Array(384).fill(0.2),
    ]);
    mockLlmChat.mockResolvedValue({ text: 'Mock answer', toolCalls: [], stopReason: 'end_turn' });
    mockLlmChatStream.mockReturnValue(
      (async function* () {
        yield 'Mock ';
        yield 'answer';
      })(),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        {
          provide: ConfigService,
          useValue: { get: () => 'postgresql://test:test@localhost:5432/test' },
        },
        { provide: EmbeddingService, useValue: { embed: mockEmbed, embedBatch: mockEmbedBatch } },
        { provide: AnthropicProvider, useValue: { chat: mockLlmChat, chatStream: mockLlmChatStream } },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
  });

  // ── chunkText ────────────────────────────────────────────────────

  describe('chunkText', () => {
    it('splits text into chunks', async () => {
      const text = `First paragraph with enough text to be a real paragraph. `.repeat(10) +
        `\n\nSecond paragraph with more content. `.repeat(10);

      const chunks = await service.chunkText(text);
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.length).toBeGreaterThan(0);
      }
    });

    it('handles short text', async () => {
      const chunks = await service.chunkText('Short text');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toContain('Short text');
    });
  });

  // ── searchSimilar ────────────────────────────────────────────────

  describe('searchSimilar', () => {
    it('returns chunks with similarity scores', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { chunk: 'Relevant chunk about policies', similarity: 0.92 },
          { chunk: 'Another relevant chunk', similarity: 0.85 },
        ],
      });

      const queryEmbedding = new Array(384).fill(0.1);
      const results = await service.searchSimilar(queryEmbedding, 3);

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBeCloseTo(0.92);
      expect(results[1].similarity).toBeCloseTo(0.85);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no matches', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const results = await service.searchSimilar(new Array(384).fill(0.1));
      expect(results).toHaveLength(0);
    });
  });

  // ── chat ─────────────────────────────────────────────────────────

  describe('chat', () => {
    it('returns answer with sources', async () => {
      mockEmbed.mockResolvedValueOnce(new Array(384).fill(0.1));
      mockQuery.mockResolvedValueOnce({
        rows: [
          { chunk: 'Refund policy: 30 day returns', similarity: 0.95 },
        ],
      });

      const result = await service.chat('What is the refund policy?');
      expect(result.answer).toBe('Mock answer');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].chunk).toContain('Refund policy');
    });

    it('returns fallback when no documents exist', async () => {
      mockEmbed.mockResolvedValueOnce(new Array(384).fill(0.1));
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.chat('question');
      expect(result.answer).toContain('No documents found');
      expect(result.sources).toHaveLength(0);
    });
  });

  // ── chatStream ───────────────────────────────────────────────────

  describe('chatStream', () => {
    it('yields sources then tokens', async () => {
      mockEmbed.mockResolvedValueOnce(new Array(384).fill(0.1));
      mockQuery.mockResolvedValueOnce({
        rows: [{ chunk: 'Chunk content', similarity: 0.9 }],
      });

      const events: { type: string; data: string }[] = [];
      for await (const event of service.chatStream('test question')) {
        events.push(event);
      }

      expect(events[0].type).toBe('sources');
      expect(JSON.parse(events[0].data)).toHaveLength(1);

      expect(events[1].type).toBe('token');
      expect(events[1].data).toBe('Mock ');

      expect(events[2].type).toBe('token');
      expect(events[2].data).toBe('answer');

      expect(events[events.length - 1].type).toBe('done');
    });

    it('yields fallback when no documents', async () => {
      mockEmbed.mockResolvedValueOnce(new Array(384).fill(0.1));
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const events: { type: string; data: string }[] = [];
      for await (const event of service.chatStream('test')) {
        events.push(event);
      }

      expect(events[0].type).toBe('token');
      expect(events[0].data).toContain('No documents found');
    });
  });

  // ── listDocuments ────────────────────────────────────────────────

  describe('listDocuments', () => {
    it('returns document summaries', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: '1',
            title: 'Doc 1',
            content_type: 'text/plain',
            created_by: 'user1',
            created_at: new Date('2025-01-01'),
          },
        ],
      });

      const docs = await service.listDocuments();
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe('Doc 1');
    });
  });
});

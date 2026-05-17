import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;

  const mockKnowledgeService = {
    parseDocument: jest.fn(),
    ingestDocument: jest.fn(),
    listDocuments: jest.fn(),
    deleteDocument: jest.fn(),
    chat: jest.fn(),
    chatStream: jest.fn(),
  };

  const mockUser = { sub: 'user-1', email: 'test@test.com', role: 'USER', permissions: [] };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeController],
      providers: [{ provide: KnowledgeService, useValue: mockKnowledgeService }],
    }).compile();

    controller = module.get<KnowledgeController>(KnowledgeController);
  });

  describe('POST /agent/documents/upload', () => {
    const mockFile = {
      buffer: Buffer.from('test content'),
      mimetype: 'text/plain',
      originalname: 'test.txt',
      size: 1024,
    } as Express.Multer.File;

    it('uploads a document', async () => {
      mockKnowledgeService.parseDocument.mockResolvedValue('parsed content');
      mockKnowledgeService.ingestDocument.mockResolvedValue({ id: 'doc-1', title: 'Test Doc' });

      const result = await controller.uploadDocument(mockFile, 'Test Doc', mockUser);

      expect(result.id).toBe('doc-1');
      expect(mockKnowledgeService.parseDocument).toHaveBeenCalledWith(mockFile.buffer, mockFile.mimetype);
      expect(mockKnowledgeService.ingestDocument).toHaveBeenCalledWith(
        'Test Doc', 'parsed content', 'text/plain', 'user-1',
      );
    });

    it('throws when file is missing', async () => {
      await expect(
        controller.uploadDocument(null as any, 'Title', mockUser),
      ).rejects.toThrow('File is required');
    });

    it('throws when title is missing', async () => {
      await expect(
        controller.uploadDocument(mockFile, '', mockUser),
      ).rejects.toThrow('Title is required');
    });
  });

  describe('GET /agent/documents', () => {
    it('returns list of documents', async () => {
      const docs = [
        { id: 'doc-1', title: 'Doc 1', contentType: 'text/plain', createdBy: 'user-1', createdAt: new Date() },
      ];
      mockKnowledgeService.listDocuments.mockResolvedValue(docs);

      const result = await controller.listDocuments();

      expect(result).toEqual(docs);
      expect(mockKnowledgeService.listDocuments).toHaveBeenCalled();
    });

    it('returns empty list when no documents', async () => {
      mockKnowledgeService.listDocuments.mockResolvedValue([]);

      const result = await controller.listDocuments();

      expect(result).toEqual([]);
    });
  });

  describe('DELETE /agent/documents/:id', () => {
    it('deletes a document', async () => {
      mockKnowledgeService.deleteDocument.mockResolvedValue(undefined);

      const result = await controller.deleteDocument('doc-1');

      expect(result).toEqual({ deleted: 'doc-1' });
      expect(mockKnowledgeService.deleteDocument).toHaveBeenCalledWith('doc-1');
    });

    it('throws when document not found', async () => {
      mockKnowledgeService.deleteDocument.mockRejectedValue(new Error('Document not found'));

      await expect(controller.deleteDocument('unknown')).rejects.toThrow('Document not found');
    });
  });

  describe('POST /agent/chat', () => {
    it('returns chat answer with sources', async () => {
      mockKnowledgeService.chat.mockResolvedValue({
        answer: 'Here is the answer',
        sources: [{ chunk: 'source chunk', similarity: 0.9 }],
      });

      const result = await controller.chat('What is the policy?');

      expect(result.answer).toBe('Here is the answer');
      expect(result.sources).toHaveLength(1);
      expect(mockKnowledgeService.chat).toHaveBeenCalledWith('What is the policy?');
    });

    it('throws when question is missing', async () => {
      await expect(controller.chat('')).rejects.toThrow('Question is required');
    });
  });

  describe('POST /agent/chat/stream', () => {
    it('streams events via SSE', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const asyncGen = (async function* () {
        yield { type: 'sources', data: '[{"chunk":"test"}]' };
        yield { type: 'token', data: 'Hello' };
        yield { type: 'done', data: '{}' };
      })();
      mockKnowledgeService.chatStream.mockReturnValue(asyncGen);

      await controller.chatStream('test question', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.flushHeaders).toHaveBeenCalled();
      expect(mockRes.write).toHaveBeenCalledTimes(3);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('returns 400 when question is missing', async () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      } as unknown as Response;

      await controller.chatStream('', mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Question is required' });
    });

    it('handles stream errors gracefully', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const asyncGen = (async function* () {
        yield { type: 'token', data: 'ok' };
        throw new Error('Stream broke');
      })();
      mockKnowledgeService.chatStream.mockReturnValue(asyncGen);

      await controller.chatStream('test', mockRes);

      expect(mockRes.write).toHaveBeenCalled(); // first event written
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});

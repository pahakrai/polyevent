import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AgentProxyController } from './agent-proxy.controller';

const createAxiosError = (status: number, data: unknown) => {
  const err = new Error() as any;
  err.isAxiosError = true;
  err.response = { status, data };
  return err;
};

const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
};

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
};

const mockReq = (overrides: Record<string, any> = {}) => ({
  headers: { authorization: 'Bearer token' },
  params: {},
  body: {},
  is: jest.fn().mockReturnValue(false),
  pipe: jest.fn(),
  ...overrides,
}) as any;

jest.mock('http', () => {
  const actual = jest.requireActual('http');
  const { EventEmitter } = require('events');

  const mockReq = new EventEmitter() as any;
  mockReq.write = jest.fn();
  mockReq.end = jest.fn();

  const mockRes = new EventEmitter() as any;
  mockRes.statusCode = 200;
  mockRes.pipe = jest.fn();

  return {
    ...actual,
    request: jest.fn((_url: string, _options: any, callback?: any) => {
      if (callback) callback(mockRes);
      return mockReq;
    }),
  };
});

describe('AgentProxyController', () => {
  let controller: AgentProxyController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentProxyController],
      providers: [{ provide: HttpService, useValue: mockHttpService }],
    }).compile();

    controller = module.get<AgentProxyController>(AgentProxyController);
  });

  describe('POST /agent/investigate (JSON)', () => {
    it('proxies investigate with JSON body', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 201, data: { sessionId: 'sess-1', jobId: 'job-1' } }));
      const res = mockRes();
      const req = mockReq({ body: { goal: 'Test', vendorId: 'v-1' } });

      await controller.investigate(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ sessionId: 'sess-1', jobId: 'job-1' });
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/agent/investigate'),
        { goal: 'Test', vendorId: 'v-1' },
        expect.any(Object),
      );
    });
  });

  describe('POST /agent/investigate/:sessionId/continue', () => {
    it('proxies continue with sessionId', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { sessionId: 'sess-1', status: 'in_progress' } }));
      const res = mockRes();

      await controller.continueInvestigation(mockReq({ params: { sessionId: 'sess-1' } }), res);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/agent/investigate/sess-1/continue'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('POST /agent/investigate/:sessionId/cancel', () => {
    it('proxies cancel', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { status: 'cancelled' } }));
      const res = mockRes();

      await controller.cancelInvestigation(mockReq({ params: { sessionId: 'sess-1' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('GET /agent/investigate/:sessionId', () => {
    it('proxies get session', async () => {
      mockHttpService.get.mockReturnValue(of({ status: 200, data: { sessionId: 'sess-1', status: 'completed' } }));
      const res = mockRes();

      await controller.getSession(mockReq({ params: { sessionId: 'sess-1' } }), res);

      expect(res.json).toHaveBeenCalledWith({ sessionId: 'sess-1', status: 'completed' });
    });
  });

  describe('POST /agent/documents/upload (multipart)', () => {
    it('uses pipeMultipart for multipart/form-data requests', async () => {
      const res = mockRes();
      const req = mockReq({
        body: {},
        is: jest.fn().mockReturnValue(true),
        headers: { 'content-type': 'multipart/form-data; boundary=xyz', authorization: 'Bearer token' },
        pipe: jest.fn(),
      });

      await controller.uploadDocument(req, res);
    });
  });

  describe('GET /agent/documents', () => {
    it('proxies list documents', async () => {
      mockHttpService.get.mockReturnValue(of({ status: 200, data: [{ id: 'doc-1', title: 'Doc' }] }));
      const res = mockRes();

      await controller.listDocuments(mockReq(), res);

      expect(res.json).toHaveBeenCalledWith([{ id: 'doc-1', title: 'Doc' }]);
    });
  });

  describe('DELETE /agent/documents/:id', () => {
    it('proxies delete document', async () => {
      mockHttpService.delete.mockReturnValue(of({ status: 200, data: { deleted: 'doc-1' } }));
      const res = mockRes();

      await controller.deleteDocument(mockReq({ params: { id: 'doc-1' } }), res);

      expect(mockHttpService.delete).toHaveBeenCalledWith(
        expect.stringContaining('/agent/documents/doc-1'),
        expect.any(Object),
      );
    });
  });

  describe('POST /agent/chat', () => {
    it('proxies chat', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { answer: 'Response', sources: [] } }));
      const res = mockRes();

      await controller.chat(mockReq({ body: { question: 'Hello' } }), res);

      expect(res.json).toHaveBeenCalledWith({ answer: 'Response', sources: [] });
    });
  });

  describe('POST /agent/chat/stream', () => {
    it('sets SSE headers and streams', async () => {
      const res = mockRes();
      const req = mockReq({
        body: { question: 'test' },
        headers: { authorization: 'Bearer token', 'x-user-id': 'u1' },
      });

      await controller.chatStream(req, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    });
  });

  describe('error handling', () => {
    it('returns 400 from upstream', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => createAxiosError(400, { message: 'Bad request' })));
      const res = mockRes();

      await controller.getSession(mockReq({ params: { sessionId: 'bad' } }), res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 502 with agent-specific message when unreachable', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => {
        const e = new Error('ECONNREFUSED') as any;
        e.isAxiosError = true;
        e.response = undefined;
        return e;
      }));
      const res = mockRes();

      await controller.listDocuments(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({ message: 'Agent service unavailable' });
    });
  });
});

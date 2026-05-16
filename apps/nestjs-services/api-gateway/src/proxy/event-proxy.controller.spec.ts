import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { EventProxyController } from './event-proxy.controller';

const createAxiosError = (status: number, data: unknown) => {
  const err = new Error() as any;
  err.isAxiosError = true;
  err.response = { status, data };
  return err;
};

const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
};

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides: Record<string, any> = {}) => ({
  headers: { authorization: 'Bearer token' },
  query: {},
  params: {},
  body: {},
  ...overrides,
}) as any;

describe('EventProxyController', () => {
  let controller: EventProxyController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventProxyController],
      providers: [{ provide: HttpService, useValue: mockHttpService }],
    }).compile();

    controller = module.get<EventProxyController>(EventProxyController);
  });

  describe('GET /events', () => {
    it('proxies get events with query params', async () => {
      mockHttpService.get.mockReturnValue(of({ status: 200, data: [{ id: 'evt-1' }] }));
      const res = mockRes();

      await controller.getEvents(mockReq({ query: { page: 1 } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ id: 'evt-1' }]);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/events'),
        expect.objectContaining({ params: { page: 1 } }),
      );
    });
  });

  describe('GET /events/:id', () => {
    it('proxies get event by id with params substituted', async () => {
      mockHttpService.get.mockReturnValue(of({ status: 200, data: { id: 'evt-1', title: 'Test' } }));
      const res = mockRes();

      await controller.getEvent(mockReq({ params: { id: 'evt-1' } }), res);

      expect(res.json).toHaveBeenCalledWith({ id: 'evt-1', title: 'Test' });
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/events/evt-1'),
        expect.any(Object),
      );
    });
  });

  describe('POST /events', () => {
    it('proxies create event with body', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 201, data: { id: 'evt-new', title: 'New' } }));
      const res = mockRes();

      await controller.createEvent(mockReq({ body: { title: 'New' } }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/events'),
        { title: 'New' },
        expect.any(Object),
      );
    });
  });

  describe('PATCH /events/:id', () => {
    it('proxies update event', async () => {
      mockHttpService.patch.mockReturnValue(of({ status: 200, data: { id: 'evt-1', title: 'Updated' } }));
      const res = mockRes();

      await controller.updateEvent(mockReq({ params: { id: 'evt-1' }, body: { title: 'Updated' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHttpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/events/evt-1'),
        { title: 'Updated' },
        expect.any(Object),
      );
    });
  });

  describe('POST /events/:id/publish', () => {
    it('proxies publish event', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { status: 'PUBLISHED' } }));
      const res = mockRes();

      await controller.publishEvent(mockReq({ params: { id: 'evt-1' } }), res);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/events/evt-1/publish'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('GET /events/category/:category', () => {
    it('proxies category search with param substitution', async () => {
      mockHttpService.get.mockReturnValue(of({ status: 200, data: [] }));
      const res = mockRes();

      await controller.eventsByCategory(mockReq({ params: { category: 'music' } }), res);

      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/events/category/music'),
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('returns upstream error status code', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => createAxiosError(404, { message: 'Not found' })));
      const res = mockRes();

      await controller.getEvents(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Not found' });
    });

    it('returns 502 when upstream is unreachable', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => {
        const e = new Error('ECONNREFUSED') as any;
        e.isAxiosError = true;
        e.response = undefined;
        return e;
      }));
      const res = mockRes();

      await controller.getEvents(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({ message: 'Service unavailable' });
    });
  });
});

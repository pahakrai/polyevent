import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AuthProxyController } from './auth-proxy.controller';

const createAxiosError = (status: number, data: unknown) => {
  const err = new Error() as any;
  err.isAxiosError = true;
  err.response = { status, data };
  return err;
};

const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
};

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('AuthProxyController', () => {
  let controller: AuthProxyController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthProxyController],
      providers: [{ provide: HttpService, useValue: mockHttpService }],
    }).compile();

    controller = module.get<AuthProxyController>(AuthProxyController);
  });

  describe('POST /auth/register', () => {
    it('proxies to auth service and returns response', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 201, data: { id: 'user-1', email: 'test@test.com' } }));
      const req = { body: { email: 'test@test.com', password: 'pass' } } as any;
      const res = mockRes();

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'user-1', email: 'test@test.com' });
    });

    it('returns upstream error status on failure', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => createAxiosError(409, { message: 'Email exists' })));
      const res = mockRes();

      await controller.register({ body: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ message: 'Email exists' });
    });

    it('returns 502 when upstream unreachable', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => {
        const e = new Error('ECONNREFUSED') as any;
        e.isAxiosError = true;
        e.response = undefined;
        return e;
      }));
      const res = mockRes();

      await controller.register({ body: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({ message: 'Service unavailable' });
    });
  });

  describe('POST /auth/login', () => {
    it('proxies login request', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { accessToken: 'at', refreshToken: 'rt' } }));
      const req = { body: { email: 'a@b.com', password: 'pass' } } as any;
      const res = mockRes();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ accessToken: 'at', refreshToken: 'rt' });
    });
  });

  describe('GET /auth/profile', () => {
    it('proxies profile with authorization header', async () => {
      mockHttpService.get.mockReturnValue(of({ status: 200, data: { id: 'user-1', email: 'test@test.com' } }));
      const req = { headers: { authorization: 'Bearer token123' } } as any;
      const res = mockRes();

      await controller.profile(req, res);

      expect(res.json).toHaveBeenCalledWith({ id: 'user-1', email: 'test@test.com' });
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/auth/profile'),
        expect.objectContaining({ headers: { authorization: 'Bearer token123' } }),
      );
    });

    it('returns 401 when upstream auth fails', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => createAxiosError(401, { message: 'Unauthorized' })));
      const res = mockRes();

      await controller.profile({ headers: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('proxies token refresh', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { accessToken: 'new-at', refreshToken: 'new-rt' } }));
      const req = { body: { refreshToken: 'old-rt' } } as any;
      const res = mockRes();

      await controller.refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ accessToken: 'new-at', refreshToken: 'new-rt' });
    });
  });

  describe('POST /auth/logout', () => {
    it('proxies logout with auth header', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { success: true } }));
      const req = {
        body: { refreshToken: 'rt' },
        headers: { authorization: 'Bearer token' },
      } as any;
      const res = mockRes();

      await controller.logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.any(Object),
        expect.objectContaining({ headers: { authorization: 'Bearer token' } }),
      );
    });
  });
});

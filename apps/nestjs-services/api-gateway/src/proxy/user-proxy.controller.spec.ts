import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { UserProxyController } from './user-proxy.controller';

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
  delete: jest.fn(),
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

describe('UserProxyController', () => {
  let controller: UserProxyController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserProxyController],
      providers: [{ provide: HttpService, useValue: mockHttpService }],
    }).compile();

    controller = module.get<UserProxyController>(UserProxyController);
  });

  describe('GET /users/profile', () => {
    it('proxies user profile with auth headers', async () => {
      mockHttpService.get.mockReturnValue(of({ status: 200, data: { id: 'u1', email: 'test@test.com' } }));
      const res = mockRes();

      await controller.getUserProfile(mockReq(), res);

      expect(res.json).toHaveBeenCalledWith({ id: 'u1', email: 'test@test.com' });
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/users/profile'),
        expect.objectContaining({
          headers: expect.objectContaining({ authorization: 'Bearer token' }),
        }),
      );
    });
  });

  describe('PATCH /users/profile', () => {
    it('proxies profile update', async () => {
      mockHttpService.patch.mockReturnValue(of({ status: 200, data: { id: 'u1', firstName: 'New' } }));
      const res = mockRes();

      await controller.updateUserProfile(mockReq({ body: { firstName: 'New' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHttpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/users/profile'),
        { firstName: 'New' },
        expect.any(Object),
      );
    });
  });

  describe('POST /groups', () => {
    it('proxies create group', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 201, data: { id: 'g1', name: 'Test' } }));
      const res = mockRes();

      await controller.createGroup(mockReq({ body: { name: 'Test' } }), res);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('DELETE /groups/:id', () => {
    it('proxies delete group', async () => {
      mockHttpService.delete.mockReturnValue(of({ status: 200, data: { deleted: true } }));
      const res = mockRes();

      await controller.deleteGroup(mockReq({ params: { id: 'g1' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHttpService.delete).toHaveBeenCalledWith(
        expect.stringContaining('/groups/g1'),
        expect.any(Object),
      );
    });
  });

  describe('POST /groups/:id/join', () => {
    it('proxies join group', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { groupId: 'g1', userId: 'u1' } }));
      const res = mockRes();

      await controller.joinGroup(mockReq({ params: { id: 'g1' } }), res);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/groups/g1/join'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('POST /groups/:id/members/:userId', () => {
    it('proxies add member with nested params', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { ok: true } }));
      const res = mockRes();

      await controller.addGroupMember(mockReq({ params: { id: 'g1', userId: 'u2' } }), res);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/groups/g1/members/u2'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('forwards upstream 404', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => createAxiosError(404, { message: 'Not found' })));
      const res = mockRes();

      await controller.getUser(mockReq({ params: { id: 'unknown' } }), res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 502 on unreachable service', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => {
        const e = new Error('ETIMEDOUT') as any;
        e.isAxiosError = true;
        e.response = undefined;
        return e;
      }));
      const res = mockRes();

      await controller.getGroups(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({ message: 'Service unavailable' });
    });
  });
});

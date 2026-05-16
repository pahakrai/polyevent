import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { VendorProxyController } from './vendor-proxy.controller';

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
  params: {},
  body: {},
  ...overrides,
}) as any;

describe('VendorProxyController', () => {
  let controller: VendorProxyController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorProxyController],
      providers: [{ provide: HttpService, useValue: mockHttpService }],
    }).compile();

    controller = module.get<VendorProxyController>(VendorProxyController);
  });

  describe('POST /vendors', () => {
    it('proxies create vendor', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 201, data: { id: 'v-1', businessName: 'Biz' } }));
      const res = mockRes();

      await controller.postVendors(mockReq({ body: { businessName: 'Biz' } }), res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/vendors'),
        { businessName: 'Biz' },
        expect.any(Object),
      );
    });
  });

  describe('GET /vendors', () => {
    it('proxies list vendors', async () => {
      mockHttpService.get.mockReturnValue(of({ status: 200, data: [{ id: 'v-1' }] }));
      const res = mockRes();

      await controller.getVendors(mockReq(), res);

      expect(res.json).toHaveBeenCalledWith([{ id: 'v-1' }]);
    });
  });

  describe('PATCH /vendors/:id', () => {
    it('proxies update vendor', async () => {
      mockHttpService.patch.mockReturnValue(of({ status: 200, data: { id: 'v-1', businessName: 'Updated' } }));
      const res = mockRes();

      await controller.patchVendor(mockReq({ params: { id: 'v-1' }, body: { businessName: 'Updated' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHttpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/vendors/v-1'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('POST /vendors/:id/verify', () => {
    it('proxies verify vendor', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { status: 'VERIFIED' } }));
      const res = mockRes();

      await controller.verifyVendor(mockReq({ params: { id: 'v-1' } }), res);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/vendors/v-1/verify'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('POST /vendors/:vendorId/venues', () => {
    it('proxies create venue with vendorId', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 201, data: { id: 'venue-1', name: 'Hall' } }));
      const res = mockRes();

      await controller.postVenue(mockReq({ params: { vendorId: 'v-1' }, body: { name: 'Hall' } }), res);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/vendors/v-1/venues'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('DELETE /venues/:id', () => {
    it('proxies delete venue', async () => {
      mockHttpService.delete.mockReturnValue(of({ status: 200, data: { deleted: true } }));
      const res = mockRes();

      await controller.deleteVenue(mockReq({ params: { id: 'venue-1' } }), res);

      expect(mockHttpService.delete).toHaveBeenCalledWith(
        expect.stringContaining('/venues/venue-1'),
        expect.any(Object),
      );
    });
  });

  describe('POST /timeslots/:id/block', () => {
    it('proxies block timeslot', async () => {
      mockHttpService.post.mockReturnValue(of({ status: 200, data: { status: 'BLOCKED' } }));
      const res = mockRes();

      await controller.blockTimeslot(mockReq({ params: { id: 'slot-1' } }), res);

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/timeslots/slot-1/block'),
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('returns 403 on upstream forbidden', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => createAxiosError(403, { message: 'Forbidden' })));
      const res = mockRes();

      await controller.getVendorStats(mockReq({ params: { id: 'v-1' } }), res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 502 when service is unavailable', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => {
        const e = new Error('ECONNREFUSED') as any;
        e.isAxiosError = true;
        e.response = undefined;
        return e;
      }));
      const res = mockRes();

      await controller.getVenues(mockReq({ params: { vendorId: 'v-1' } }), res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({ message: 'Service unavailable' });
    });
  });
});

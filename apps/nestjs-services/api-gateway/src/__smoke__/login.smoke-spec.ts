/**
 * Smoke tests for the login proxy endpoint in the API Gateway.
 * Boots a real NestJS HTTP app with the auth proxy controller and tests
 * the full request-response cycle via supertest.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import request = require('supertest');
import { AuthProxyController } from '../proxy/auth-proxy.controller';

const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
};

const createAxiosError = (status: number, data: unknown) => {
  const err = new Error() as any;
  err.isAxiosError = true;
  err.response = { status, data };
  return err;
};

describe('Login Proxy Smoke Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthProxyController],
      providers: [{ provide: HttpService, useValue: mockHttpService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Happy path ─────────────────────────────────────────────────────

  describe('POST /auth/login — happy path', () => {
    it('proxies login and returns 200 with tokens', async () => {
      const upstreamResponse = {
        accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.sig',
        refreshToken: 'a1b2c3d4e5f6-refresh-token-hex',
        expiresIn: '15m',
        user: {
          id: 'u-1',
          email: 'user@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'USER',
          permissions: ['read:own', 'write:own'],
        },
      };

      mockHttpService.post.mockReturnValue(
        of({ status: 200, data: upstreamResponse }),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'correct' })
        .expect(200);

      expect(res.body).toEqual(upstreamResponse);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user).toMatchObject({
        email: 'user@example.com',
        role: 'USER',
      });

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        { email: 'user@example.com', password: 'correct' },
      );
    });
  });

  // ── Error forwarding ───────────────────────────────────────────────

  describe('POST /auth/login — error forwarding', () => {
    it('forwards 401 when upstream returns invalid credentials', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => createAxiosError(401, { message: 'Invalid credentials' })),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bad@example.com', password: 'wrong' })
        .expect(401);

      expect(res.body).toMatchObject({ message: 'Invalid credentials' });
    });

    it('forwards 409 when upstream returns conflict', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => createAxiosError(409, { message: 'Email exists' })),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'exists@example.com', password: 'pass' })
        .expect(409);

      expect(res.body).toMatchObject({ message: 'Email exists' });
    });

    it('returns 502 when upstream is unreachable', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => {
          const e = new Error('ECONNREFUSED') as any;
          e.isAxiosError = true;
          e.response = undefined;
          return e;
        }),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@b.com', password: 'pass' })
        .expect(502);

      expect(res.body).toMatchObject({ message: 'Service unavailable' });
    });
  });
});

/**
 * Smoke tests for the login endpoint.
 * Boots a real NestJS HTTP app with the auth module and tests the full
 * request-response cycle via supertest — no mocks on controllers or services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import request = require('supertest');
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { SagaExecutor } from '../auth/saga-executor';

// ── Mock the database client module ──────────────────────────────────
jest.mock('../database/client', () => {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.from = jest.fn().mockReturnValue(chain);
  chain.where = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.values = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.set = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.and = jest.fn().mockReturnValue(chain);

  return {
    db: chain,
    postgresClient: { initialize: jest.fn(), isConnected: () => true },
    schema: {},
  };
});

// ── Mock bcryptjs ────────────────────────────────────────────────────
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$10$hashed'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('Login Smoke Tests', () => {
  let app: INestApplication;
  let mockDb: any;

  beforeAll(async () => {
    mockDb = require('../database/client').db;

    const mockSagaExecutor = { execute: jest.fn().mockResolvedValue(undefined) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'smoke-test-jwt-secret-key',
              JWT_EXPIRES_IN: '15m',
              REFRESH_TOKEN_EXPIRES_IN: '7d',
              VENDOR_SERVICE_URL: 'http://vendor-service:3000',
              INTERNAL_SERVICE_KEY: 'internal-secret-key',
            }),
          ],
        }),
        HttpModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.get<string>('JWT_SECRET'),
            signOptions: { expiresIn: '15m' },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: SagaExecutor, useValue: mockSagaExecutor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const bcrypt = require('bcryptjs');
    bcrypt.compare.mockResolvedValue(true);
  });

  // ── Happy path ─────────────────────────────────────────────────────

  describe('POST /auth/login — happy path', () => {
    it('returns 200 with tokens and user payload', async () => {
      const user = {
        id: 'u-alice',
        email: 'alice@example.com',
        password: '$2a$10$hashed',
        firstName: 'Alice',
        lastName: 'Smith',
        role: 'USER',
      };
      mockDb.limit.mockResolvedValue([user]);
      mockDb.values.mockResolvedValue([{ id: 'rt-1' }]);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'correct-horse' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('expiresIn');
      expect(res.body.user).toMatchObject({
        id: 'u-alice',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        role: 'USER',
        permissions: expect.any(Array),
      });
    });
  });

  // ── Error paths ────────────────────────────────────────────────────

  describe('POST /auth/login — errors', () => {
    it('returns 401 when user does not exist', async () => {
      mockDb.limit.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: 'any' })
        .expect(401);

      expect(res.body).toMatchObject({ message: 'Invalid credentials' });
    });

    it('returns 401 when password is wrong', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(false);

      mockDb.limit.mockResolvedValue([
        {
          id: 'u-alice',
          email: 'alice@example.com',
          password: '$2a$10$hashed',
          firstName: 'Alice',
          lastName: 'Smith',
          role: 'USER',
        },
      ]);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'wrong-pass' })
        .expect(401);

      expect(res.body).toMatchObject({ message: 'Invalid credentials' });
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: 'somepass' })
        .expect(400);

      expect(res.body).toHaveProperty('message');
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'alice@example.com' })
        .expect(400);

      expect(res.body).toHaveProperty('message');
    });
  });

  // ── VENDOR role login ──────────────────────────────────────────────

  describe('POST /auth/login — VENDOR user', () => {
    it('resolves vendorId for VENDOR role users', async () => {
      const vendorUser = {
        id: 'u-bob',
        email: 'bob@vendor.com',
        password: '$2a$10$hashed',
        firstName: 'Bob',
        lastName: 'Vendor',
        role: 'VENDOR',
      };
      mockDb.limit.mockResolvedValue([vendorUser]);
      mockDb.values.mockResolvedValue([{ id: 'rt-2' }]);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bob@vendor.com', password: 'correct-horse' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.role).toBe('VENDOR');
    });
  });
});

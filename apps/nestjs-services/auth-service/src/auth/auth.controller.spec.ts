import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/register', () => {
    it('registers a new user', async () => {
      const dto = {
        email: 'test@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };
      const registered = { id: 'user-1', ...dto, role: 'USER' };
      mockAuthService.register.mockResolvedValue(registered);

      const result = await controller.register(dto);

      expect(result).toEqual(registered);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });

    it('registers a vendor user with vendor fields', async () => {
      const dto = {
        email: 'vendor@test.com',
        password: 'password123',
        firstName: 'Vendor',
        lastName: 'Owner',
        role: 'VENDOR',
        vendor: {
          businessName: 'My Business',
          category: 'MUSIC',
          contactEmail: 'vendor@test.com',
          contactPhone: '555-1234',
          address: { street: '123 Main' },
          location: { lat: 40.7, lon: -74.0 },
        },
      };
      mockAuthService.register.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: '15m',
        user: { id: 'user-2', email: dto.email, firstName: dto.firstName, lastName: dto.lastName, role: 'VENDOR', permissions: [] },
      });

      const result = await controller.register(dto);

      expect(result.user.role).toBe('VENDOR');
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });

    it('handles duplicate email error', async () => {
      mockAuthService.register.mockRejectedValue(new Error('Email already exists'));

      await expect(
        controller.register({
          email: 'exists@test.com',
          password: 'password123',
          firstName: 'A',
          lastName: 'B',
        }),
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with valid credentials', async () => {
      const dto = { email: 'test@test.com', password: 'password123' };
      const tokens = { accessToken: 'access', refreshToken: 'refresh', user: { id: 'user-1' } };
      mockAuthService.login.mockResolvedValue(tokens);

      const result = await controller.login(dto);

      expect(result).toEqual(tokens);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
    });

    it('throws on invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(
        controller.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('GET /auth/profile', () => {
    it('returns profile for authenticated user', async () => {
      const profile = { id: 'user-1', email: 'test@test.com', firstName: 'Test' };
      mockAuthService.getProfile.mockResolvedValue(profile);
      const req = { user: { sub: 'user-1' } } as any;

      const result = await controller.profile(req);

      expect(result).toEqual(profile);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-1');
    });

    it('returns null when user profile not found', async () => {
      mockAuthService.getProfile.mockResolvedValue(null);
      const req = { user: { sub: 'unknown' } } as any;

      const result = await controller.profile(req);

      expect(result).toBeNull();
    });
  });

  describe('POST /auth/refresh', () => {
    it('refreshes tokens', async () => {
      const dto = { refreshToken: 'old-refresh' };
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      mockAuthService.refreshToken.mockResolvedValue(tokens);

      const result = await controller.refresh(dto);

      expect(result).toEqual(tokens);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('old-refresh');
    });

    it('throws on expired token', async () => {
      mockAuthService.refreshToken.mockRejectedValue(new Error('Invalid or expired refresh token'));

      await expect(
        controller.refresh({ refreshToken: 'expired' }),
      ).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('POST /auth/logout', () => {
    it('logs out successfully', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });
      const dto = { refreshToken: 'token-to-revoke' };
      const req = { user: { sub: 'user-1' } } as any;

      const result = await controller.logout(dto, req);

      expect(result).toEqual({ success: true });
      expect(mockAuthService.logout).toHaveBeenCalledWith('token-to-revoke', 'user-1');
    });

    it('throws on invalid token', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('Invalid token'));

      const dto = { refreshToken: 'bad-token' };
      const req = { user: { sub: 'user-1' } } as any;

      await expect(controller.logout(dto, req)).rejects.toThrow('Invalid token');
    });
  });
});

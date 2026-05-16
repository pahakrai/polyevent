import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  const mockUserService = {
    getProfile: jest.fn(),
    findById: jest.fn(),
    updateProfile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  describe('GET /users/profile', () => {
    it('returns profile for authenticated user', async () => {
      const profile = { id: 'user-1', email: 'test@test.com', firstName: 'Test' };
      mockUserService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile('user-1');

      expect(result).toEqual(profile);
      expect(mockUserService.getProfile).toHaveBeenCalledWith('user-1');
    });

    it('returns null when user not found', async () => {
      mockUserService.getProfile.mockResolvedValue(null);

      const result = await controller.getProfile('unknown');

      expect(result).toBeNull();
    });
  });

  describe('GET /users/:id', () => {
    it('returns user by id', async () => {
      const user = { id: 'user-2', email: 'other@test.com' };
      mockUserService.findById.mockResolvedValue(user);

      const result = await controller.findById('user-2');

      expect(result).toEqual(user);
      expect(mockUserService.findById).toHaveBeenCalledWith('user-2');
    });

    it('returns null when user not found', async () => {
      mockUserService.findById.mockResolvedValue(null);

      const result = await controller.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('PATCH /users/profile', () => {
    it('updates profile and returns updated user', async () => {
      const dto = { firstName: 'Updated' };
      const updated = { id: 'user-1', firstName: 'Updated', email: 'test@test.com' };
      mockUserService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile('user-1', dto);

      expect(result).toEqual(updated);
      expect(mockUserService.updateProfile).toHaveBeenCalledWith('user-1', dto);
    });

    it('handles full profile update with all fields', async () => {
      const dto = {
        firstName: 'New',
        lastName: 'Name',
        phone: '555-1234',
        bio: 'Hello',
        interests: ['music', 'sports'],
      };
      mockUserService.updateProfile.mockResolvedValue({ id: 'user-1', ...dto, email: 'a@b.com' });

      const result = await controller.updateProfile('user-1', dto);

      expect(mockUserService.updateProfile).toHaveBeenCalledWith('user-1', dto);
      expect(result.firstName).toBe('New');
    });
  });
});

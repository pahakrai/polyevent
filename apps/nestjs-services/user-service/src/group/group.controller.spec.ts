import { Test, TestingModule } from '@nestjs/testing';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';

describe('GroupController', () => {
  let controller: GroupController;
  const mockGroupService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByUser: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [{ provide: GroupService, useValue: mockGroupService }],
    }).compile();

    controller = module.get<GroupController>(GroupController);
  });

  describe('POST /groups', () => {
    it('creates a group and returns it', async () => {
      const dto = { name: 'Jazz Lovers', description: 'A group for jazz fans' };
      const created = { id: 'g1', ...dto, ownerId: 'user-1', memberCount: 1 };
      mockGroupService.create.mockResolvedValue(created);

      const result = await controller.create('user-1', dto);

      expect(result).toEqual(created);
      expect(mockGroupService.create).toHaveBeenCalledWith('user-1', dto);
    });

    it('creates a group without optional description', async () => {
      const dto = { name: 'Minimal Group' };
      mockGroupService.create.mockResolvedValue({ id: 'g2', name: 'Minimal Group', ownerId: 'user-1' });

      const result = await controller.create('user-1', dto);

      expect(result.name).toBe('Minimal Group');
      expect(mockGroupService.create).toHaveBeenCalledWith('user-1', { name: 'Minimal Group' });
    });
  });

  describe('GET /groups', () => {
    it('returns paginated groups with defaults', async () => {
      const groups = [{ id: 'g1', name: 'Group 1' }];
      mockGroupService.findAll.mockResolvedValue(groups);

      const result = await controller.findAll(1, 20);

      expect(result).toEqual(groups);
      expect(mockGroupService.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('passes interests filter', async () => {
      mockGroupService.findAll.mockResolvedValue([]);

      await controller.findAll(1, 20, 'music,jazz');

      expect(mockGroupService.findAll).toHaveBeenCalledWith(1, 20, 'music,jazz');
    });

    it('uses custom page and limit', async () => {
      mockGroupService.findAll.mockResolvedValue([]);

      await controller.findAll(2, 10);

      expect(mockGroupService.findAll).toHaveBeenCalledWith(2, 10, undefined);
    });
  });

  describe('GET /groups/user/:userId', () => {
    it('returns groups for user', async () => {
      const groups = [{ id: 'g1', name: 'My Group' }];
      mockGroupService.findByUser.mockResolvedValue(groups);

      const result = await controller.findByUser('user-1');

      expect(result).toEqual(groups);
      expect(mockGroupService.findByUser).toHaveBeenCalledWith('user-1');
    });

    it('returns empty array when user has no groups', async () => {
      mockGroupService.findByUser.mockResolvedValue([]);

      const result = await controller.findByUser('user-empty');

      expect(result).toEqual([]);
    });
  });

  describe('GET /groups/:id', () => {
    it('returns group by id', async () => {
      const group = { id: 'g1', name: 'Test Group', members: [] };
      mockGroupService.findById.mockResolvedValue(group);

      const result = await controller.findById('g1');

      expect(result).toEqual(group);
      expect(mockGroupService.findById).toHaveBeenCalledWith('g1');
    });

    it('returns null when group not found', async () => {
      mockGroupService.findById.mockResolvedValue(null);

      const result = await controller.findById('unknown');

      expect(result).toBeNull();
    });
  });

  describe('PATCH /groups/:id', () => {
    it('updates group and returns it', async () => {
      const dto = { name: 'Updated Name' };
      const updated = { id: 'g1', name: 'Updated Name' };
      mockGroupService.update.mockResolvedValue(updated);

      const result = await controller.update('g1', 'user-1', dto);

      expect(result).toEqual(updated);
      expect(mockGroupService.update).toHaveBeenCalledWith('g1', 'user-1', dto);
    });

    it('updates with isPrivate flag', async () => {
      const dto = { isPrivate: true };
      mockGroupService.update.mockResolvedValue({ id: 'g1', isPrivate: true });

      await controller.update('g1', 'user-1', dto);

      expect(mockGroupService.update).toHaveBeenCalledWith('g1', 'user-1', dto);
    });
  });

  describe('DELETE /groups/:id', () => {
    it('removes group', async () => {
      mockGroupService.remove.mockResolvedValue({ deleted: true });

      const result = await controller.remove('g1', 'user-1');

      expect(result).toEqual({ deleted: true });
      expect(mockGroupService.remove).toHaveBeenCalledWith('g1', 'user-1');
    });
  });

  describe('POST /groups/:id/join', () => {
    it('joins a group', async () => {
      const membership = { groupId: 'g1', userId: 'user-2', role: 'member' };
      mockGroupService.join.mockResolvedValue(membership);

      const result = await controller.join('g1', 'user-2');

      expect(result).toEqual(membership);
      expect(mockGroupService.join).toHaveBeenCalledWith('g1', 'user-2');
    });

    it('throws when group not found', async () => {
      mockGroupService.join.mockRejectedValue(new Error('Group not found'));

      await expect(controller.join('unknown', 'user-1')).rejects.toThrow('Group not found');
    });
  });

  describe('POST /groups/:id/leave', () => {
    it('leaves a group', async () => {
      mockGroupService.leave.mockResolvedValue({ success: true });

      const result = await controller.leave('g1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(mockGroupService.leave).toHaveBeenCalledWith('g1', 'user-1');
    });

    it('throws when not a member', async () => {
      mockGroupService.leave.mockRejectedValue(new Error('Not a member'));

      await expect(controller.leave('g1', 'user-1')).rejects.toThrow('Not a member');
    });
  });

  describe('POST /groups/:id/members/:userId', () => {
    it('adds a member to group', async () => {
      const member = { groupId: 'g1', userId: 'user-3', role: 'member' };
      mockGroupService.addMember.mockResolvedValue(member);

      const result = await controller.addMember('g1', 'user-3', 'user-1');

      expect(result).toEqual(member);
      expect(mockGroupService.addMember).toHaveBeenCalledWith('g1', 'user-1', 'user-3');
    });

    it('throws when owner is not the group owner', async () => {
      mockGroupService.addMember.mockRejectedValue(new Error('Unauthorized'));

      await expect(controller.addMember('g1', 'user-3', 'not-owner')).rejects.toThrow('Unauthorized');
    });
  });

  describe('DELETE /groups/:id/members/:userId', () => {
    it('removes a member from group', async () => {
      mockGroupService.removeMember.mockResolvedValue({ success: true });

      const result = await controller.removeMember('g1', 'user-3', 'user-1');

      expect(result).toEqual({ success: true });
      expect(mockGroupService.removeMember).toHaveBeenCalledWith('g1', 'user-1', 'user-3');
    });

    it('throws when member not found', async () => {
      mockGroupService.removeMember.mockRejectedValue(new Error('Member not found'));

      await expect(controller.removeMember('g1', 'unknown', 'user-1')).rejects.toThrow('Member not found');
    });
  });
});

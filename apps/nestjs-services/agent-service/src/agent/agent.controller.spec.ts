import { Test, TestingModule } from '@nestjs/testing';
import { Subject, firstValueFrom } from 'rxjs';
import { AgentController } from './agent.controller';
import { InvestigationService } from './investigation.service';
import { InvestigationQueue } from './investigation-queue.service';
import { SessionStore } from './session-store.service';
import { InvestigationEventBus } from './investigation-event.bus';

const createMockSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'sess-1',
  vendorId: 'v-1',
  goal: 'Test goal',
  mode: 'auto' as const,
  isSuperadmin: false,
  status: 'in_progress',
  steps: [] as any[],
  error: undefined as string | undefined,
  createdAt: new Date().toISOString(),
  messages: [] as any[],
  cancelled: false,
  ...overrides,
});

describe('AgentController', () => {
  let controller: AgentController;

  const mockInvestigationService = {
    createSession: jest.fn(),
  };

  const mockQueue = {
    enqueue: jest.fn(),
    enqueueContinue: jest.fn(),
    removeSessionJobs: jest.fn(),
  };

  const mockSessionStore = {
    get: jest.fn(),
    save: jest.fn(),
    clearCancelled: jest.fn(),
    setCancelled: jest.fn(),
  };

  const mockEventBus = {
    emit: jest.fn(),
    stream: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockInvestigationService.createSession.mockReturnValue(createMockSession({ id: '' }));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        { provide: InvestigationService, useValue: mockInvestigationService },
        { provide: InvestigationQueue, useValue: mockQueue },
        { provide: SessionStore, useValue: mockSessionStore },
        { provide: InvestigationEventBus, useValue: mockEventBus },
      ],
    }).compile();

    controller = module.get<AgentController>(AgentController);
  });

  describe('POST /agent/investigate', () => {
    const baseDto = { goal: 'Test goal', vendorId: 'v-1' };

    it('starts investigation with default auto mode', async () => {
      mockQueue.enqueue.mockResolvedValue({ jobId: 'job-1', sessionId: 'sess-1' });

      const result = await controller.investigate(baseDto);

      expect(result.sessionId).toBe('sess-1');
      expect(result.jobId).toBe('job-1');
      expect(result.mode).toBe('auto');
      expect(result.isSuperadmin).toBe(false);
      expect(mockQueue.enqueue).toHaveBeenCalledWith('v-1', 'Test goal', 'auto', false);
      expect(mockSessionStore.save).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('sess-1', expect.any(Object));
    });

    it('starts investigation in manual mode', async () => {
      mockQueue.enqueue.mockResolvedValue({ jobId: 'job-2', sessionId: 'sess-2' });

      const result = await controller.investigate({ ...baseDto, mode: 'manual' });

      expect(result.mode).toBe('manual');
      expect(mockQueue.enqueue).toHaveBeenCalledWith('v-1', 'Test goal', 'manual', false);
    });

    it('starts investigation for superadmin', async () => {
      mockQueue.enqueue.mockResolvedValue({ jobId: 'job-3', sessionId: 'sess-3' });

      const result = await controller.investigate({ ...baseDto, role: 'superadmin' });

      expect(result.isSuperadmin).toBe(true);
      expect(mockQueue.enqueue).toHaveBeenCalledWith('v-1', 'Test goal', 'auto', true);
    });

    it('throws 400 when goal is missing', async () => {
      await expect(
        controller.investigate({ goal: '', vendorId: 'v-1' } as any),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when vendorId is missing', async () => {
      await expect(
        controller.investigate({ goal: 'test', vendorId: '' } as any),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('SSE /agent/investigate/:sessionId/stream', () => {
    it('returns an observable that emits stringified events', async () => {
      const subject = new Subject<{ data: unknown }>();
      mockEventBus.stream.mockReturnValue(subject.asObservable());

      const obs = controller.stream('sess-1');
      const promise = firstValueFrom(obs);
      subject.next({ data: { status: 'in_progress' } });
      subject.complete();

      const msg = await promise;
      expect(msg).toBeDefined();
      expect(msg.data).toBe(JSON.stringify({ status: 'in_progress' }));
    });
  });

  describe('POST /agent/investigate/:sessionId/continue', () => {
    it('continues a manual mode session', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession({ mode: 'manual' }));
      mockQueue.enqueueContinue.mockResolvedValue({ jobId: 'job-c1', sessionId: 'sess-1' });

      const result = await controller.continue('sess-1');

      expect(result.sessionId).toBe('sess-1');
      expect(result.jobId).toBe('job-c1');
      expect(mockSessionStore.clearCancelled).toHaveBeenCalledWith('sess-1');
      expect(mockQueue.enqueueContinue).toHaveBeenCalledWith('sess-1', 'v-1', 'Test goal', false);
    });

    it('throws 404 when session not found', async () => {
      mockSessionStore.get.mockResolvedValue(null);

      await expect(controller.continue('unknown')).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 when not in manual mode', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession({ mode: 'auto' }));

      await expect(controller.continue('sess-1')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when already completed', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession({ mode: 'manual', status: 'completed' }));

      await expect(controller.continue('sess-1')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when already cancelled', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession({ mode: 'manual', status: 'cancelled' }));

      await expect(controller.continue('sess-1')).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('POST /agent/investigate/:sessionId/cancel', () => {
    it('cancels a running investigation', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession());

      const result = await controller.cancel('sess-1');

      expect(result.status).toBe('cancelled');
      expect(mockSessionStore.setCancelled).toHaveBeenCalledWith('sess-1');
      expect(mockQueue.removeSessionJobs).toHaveBeenCalledWith('sess-1');
      expect(mockEventBus.emit).toHaveBeenCalledWith('sess-1', { status: 'cancelled' });
    });

    it('throws 404 when session not found', async () => {
      mockSessionStore.get.mockResolvedValue(null);

      await expect(controller.cancel('unknown')).rejects.toMatchObject({ status: 404 });
    });

    it('throws 400 when already completed', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession({ status: 'completed' }));

      await expect(controller.cancel('sess-1')).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when already cancelled', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession({ status: 'cancelled' }));

      await expect(controller.cancel('sess-1')).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('POST /agent/investigate/:sessionId/redirect', () => {
    it('adds redirect instruction to session', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession());

      const result = await controller.redirect('sess-1', { instruction: 'Check invoices' });

      expect(result.steps.length).toBe(1);
      expect(result.steps[0].type).toBe('redirected');
      expect(mockSessionStore.save).toHaveBeenCalled();
    });

    it('throws 400 when instruction is missing', async () => {
      await expect(
        controller.redirect('sess-1', { instruction: '' } as any),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('throws 404 when session not found', async () => {
      mockSessionStore.get.mockResolvedValue(null);

      await expect(
        controller.redirect('unknown', { instruction: 'Check' }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('GET /agent/investigate/:sessionId', () => {
    it('returns session details', async () => {
      mockSessionStore.get.mockResolvedValue(createMockSession());

      const result = await controller.getSession('sess-1');

      expect(result.sessionId).toBe('sess-1');
      expect(result.vendorId).toBe('v-1');
      expect(result.goal).toBe('Test goal');
      expect(result.mode).toBe('auto');
      expect(result.status).toBe('in_progress');
    });

    it('throws 404 when session not found', async () => {
      mockSessionStore.get.mockResolvedValue(null);

      await expect(controller.getSession('unknown')).rejects.toMatchObject({ status: 404 });
    });
  });
});

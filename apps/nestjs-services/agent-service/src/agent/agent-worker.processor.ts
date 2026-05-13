import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InvestigationService } from './investigation.service';
import { SessionStore } from './session-store.service';
import { InvestigationEventBus } from './investigation-event.bus';
import { McpClientFactory, McpConnection } from '../mcp/mcp-client.factory';
import type { InvestigationJobData } from './investigation-queue.service';
import type { InvestigationSession } from './investigation.service';
@Processor('investigation-queue', {
  concurrency: 50,
})
export class AgentWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentWorkerProcessor.name);

  constructor(
    private readonly investigationService: InvestigationService,
    private readonly sessionStore: SessionStore,
    private readonly eventBus: InvestigationEventBus,
    private readonly mcpFactory: McpClientFactory,
  ) {
    super();
  }

  async process(
    job: Job<InvestigationJobData>,
  ): Promise<{ sessionId: string; status: string }> {
    const { vendorId, goal, mode, isSuperadmin, sessionId, action } =
      job.data;

    this.logger.log(
      `Processing [${action}] ${sessionId} for vendor ${vendorId} [${mode}]`,
    );

    let mcpConnection: McpConnection | null = null;
    let slotAcquired = false;

    try {
      // Per-vendor concurrency: max 3 active jobs per vendor
      slotAcquired = await this.sessionStore.acquireVendorSlot(vendorId);
      if (!slotAcquired) {
        this.logger.warn(
          `Vendor ${vendorId} at capacity (3/3), delaying job ${job.id}`,
        );
        await job.moveToDelayed(Date.now() + 5000, job.token);
        return { sessionId, status: 'delayed' };
      }

      mcpConnection = await this.mcpFactory.create();
      const nativeTools = await mcpConnection.discoverTools();

      let session =
        action === 'continue'
          ? await this.sessionStore.get(sessionId)
          : null;

      if (!session) {
        session = this.investigationService.createSession(
          vendorId,
          goal,
          mode,
          isSuperadmin,
        );
        session.id = sessionId;
      }

      session.status = 'in_progress';

      if (await this.sessionStore.isCancelled(sessionId)) {
        session.status = 'cancelled';
        await this.persist(session);
        return { sessionId, status: 'cancelled' };
      }

      // Persist + emit SSE on every step
      await this.persist(session);

      if (mode === 'auto') {
        // runAutoLoop is internal — we use runSingleStep in a loop for visibility
        const maxLlmCalls = 10;
        while (
          !session.cancelled &&
          session.steps.filter((s) => s.type === 'reasoning').length <
            maxLlmCalls &&
          session.status === 'in_progress'
        ) {
          const stopped = await this.investigationService.runSingleStep(
            session,
            mcpConnection,
            nativeTools,
          );
          await this.persist(session);
          if (stopped) break;
        }

        if (session.cancelled) {
          session.status = 'cancelled';
        } else if (session.status === 'in_progress') {
          session.status = 'completed';
        }
      } else {
        await this.investigationService.runSingleStep(
          session,
          mcpConnection,
          nativeTools,
        );
      }

      if (session.status !== 'cancelled') {
        await this.sessionStore.clearCancelled(sessionId);
      }
      await this.persist(session);

      this.logger.log(
        `Investigation ${sessionId} finished: ${session.status}`,
      );

      return { sessionId, status: session.status };
    } catch (error) {
      this.logger.error(
        `Investigation ${sessionId} failed`,
        error as Error,
      );

      const session = await this.sessionStore.get(sessionId);
      if (session) {
        session.status = 'error';
        session.error = (error as Error).message;
        await this.persist(session);
      }

      throw error;
    } finally {
      if (slotAcquired) {
        await this.sessionStore.releaseVendorSlot(vendorId);
      }

      if (mcpConnection) {
        try {
          await mcpConnection.close();
        } catch (closeError) {
          this.logger.warn(
            `Error closing MCP connection for ${sessionId}`,
            closeError as Error,
          );
        }
      }
    }
  }

  private async persist(session: InvestigationSession): Promise<void> {
    await this.sessionStore.save(session);

    // Emit full session snapshot as SSE event
    this.eventBus.emit(session.id, {
      status: session.status,
      steps: session.steps,
      lastStep: session.steps[session.steps.length - 1] ?? null,
      timestamp: new Date().toISOString(),
    });
  }
}

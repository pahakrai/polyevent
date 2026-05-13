import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuid } from 'uuid';
import type { InvestigationMode } from './investigation.service';

export interface EnqueueResult {
  jobId: string;
  sessionId: string;
}

export interface InvestigationJobData {
  vendorId: string;
  goal: string;
  mode: InvestigationMode;
  isSuperadmin: boolean;
  sessionId: string;
  action: 'start' | 'continue';
}

@Injectable()
export class InvestigationQueue {
  private readonly logger = new Logger(InvestigationQueue.name);

  constructor(
    @InjectQueue('investigation-queue') private readonly queue: Queue,
  ) {}

  /** Enqueue a new investigation. */
  async enqueue(
    vendorId: string,
    goal: string,
    mode: InvestigationMode,
    isSuperadmin: boolean,
  ): Promise<EnqueueResult> {
    const sessionId = uuid();

    await this.queue.add(
      `investigation-${sessionId}`,
      {
        vendorId,
        goal,
        mode,
        isSuperadmin,
        sessionId,
        action: 'start',
      } satisfies InvestigationJobData,
    );

    this.logger.log(
      `Enqueued [start] ${sessionId} for vendor ${vendorId} [${mode}]`,
    );

    return { jobId: sessionId, sessionId };
  }

  /** Enqueue a continue step for an existing manual-mode session. */
  async enqueueContinue(
    sessionId: string,
    vendorId: string,
    goal: string,
    isSuperadmin: boolean,
  ): Promise<EnqueueResult> {
    const jobId = uuid();

    await this.queue.add(
      `continue-${sessionId}-${jobId}`,
      {
        vendorId,
        goal,
        mode: 'manual' as InvestigationMode,
        isSuperadmin,
        sessionId,
        action: 'continue',
      } satisfies InvestigationJobData,
    );

    this.logger.log(`Enqueued [continue] ${sessionId} (job ${jobId})`);

    return { jobId, sessionId };
  }

  /** Remove all pending jobs for a session. */
  async removeSessionJobs(sessionId: string): Promise<void> {
    const jobs = await this.queue.getJobs(['waiting', 'delayed', 'active']);
    for (const job of jobs) {
      const data = job.data as InvestigationJobData;
      if (data.sessionId === sessionId) {
        await job.remove();
        this.logger.log(`Removed job ${job.id} for session ${sessionId}`);
      }
    }
  }
}

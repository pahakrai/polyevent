import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Sse,
  HttpException,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { InvestigationService } from './investigation.service';
import { InvestigationQueue } from './investigation-queue.service';
import { SessionStore } from './session-store.service';
import { InvestigationEventBus } from './investigation-event.bus';
import { SqlSanitizerInterceptor } from './sql-sanitizer.interceptor';
import type { InvestigationMode } from './investigation.service';

export class InvestigateDto {
  goal!: string;
  vendorId!: string;
  mode?: InvestigationMode;
  role?: string;
}

export class RedirectDto {
  instruction!: string;
}

@Controller('agent')
@UseInterceptors(SqlSanitizerInterceptor)
export class AgentController {
  constructor(
    private readonly investigationService: InvestigationService,
    private readonly queue: InvestigationQueue,
    private readonly sessionStore: SessionStore,
    private readonly eventBus: InvestigationEventBus,
  ) {}

  /** Start a new investigation. Mode defaults to 'auto'. */
  @Post('investigate')
  async investigate(@Body() dto: InvestigateDto) {
    if (!dto.goal || !dto.vendorId) {
      throw new HttpException(
        'goal and vendorId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isSuperadmin = dto.role === 'superadmin';
    const mode = dto.mode || 'auto';

    const { jobId, sessionId } = await this.queue.enqueue(
      dto.vendorId,
      dto.goal,
      mode,
      isSuperadmin,
    );

    const session = this.investigationService.createSession(
      dto.vendorId,
      dto.goal,
      mode,
      isSuperadmin,
    );
    session.id = sessionId;
    await this.sessionStore.save(session);

    this.eventBus.emit(sessionId, { status: session.status });

    return {
      sessionId,
      jobId,
      mode,
      isSuperadmin,
      status: session.status,
      steps: session.steps,
      createdAt: session.createdAt,
    };
  }

  /** SSE stream for real-time investigation progress. */
  @Sse('investigate/:sessionId/stream')
  stream(
    @Param('sessionId') sessionId: string,
  ): Observable<{ data: unknown }> {
    return new Observable((observer) => {
      const sub = this.eventBus.stream(sessionId).subscribe({
        next: (event) => observer.next({ data: JSON.stringify(event.data) }),
        error: (err) => observer.error(err),
      });
      return () => sub.unsubscribe();
    });
  }

  /** Manual mode: advance one ReAct step. */
  @Post('investigate/:sessionId/continue')
  async continue(@Param('sessionId') sessionId: string) {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    if (session.mode !== 'manual') {
      throw new HttpException(
        'Continue is only available in manual mode',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (session.status === 'completed') {
      throw new HttpException(
        'Investigation already completed',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (session.status === 'cancelled') {
      throw new HttpException(
        'Investigation was cancelled',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.sessionStore.clearCancelled(sessionId);

    const { jobId } = await this.queue.enqueueContinue(
      sessionId,
      session.vendorId,
      session.goal,
      session.isSuperadmin,
    );

    return {
      sessionId,
      jobId,
      mode: session.mode,
      status: 'in_progress',
      steps: session.steps,
    };
  }

  /** Cancel a running investigation. Works for both modes. */
  @Post('investigate/:sessionId/cancel')
  async cancel(@Param('sessionId') sessionId: string) {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    if (session.status === 'completed') {
      throw new HttpException(
        'Investigation already completed',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (session.status === 'cancelled') {
      throw new HttpException(
        'Investigation already cancelled',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.sessionStore.setCancelled(sessionId);
    await this.queue.removeSessionJobs(sessionId);

    session.status = 'cancelled';
    session.cancelled = true;
    await this.sessionStore.save(session);

    this.eventBus.emit(sessionId, { status: 'cancelled' });

    return {
      sessionId,
      mode: session.mode,
      status: session.status,
      steps: session.steps,
    };
  }

  /** Vendor provides guidance mid-investigation. Works for both modes. */
  @Post('investigate/:sessionId/redirect')
  async redirect(
    @Param('sessionId') sessionId: string,
    @Body() dto: RedirectDto,
  ) {
    if (!dto.instruction) {
      throw new HttpException(
        'instruction is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    if (session.status === 'completed') {
      throw new HttpException(
        'Investigation already completed',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (session.status === 'cancelled') {
      throw new HttpException(
        'Investigation was cancelled',
        HttpStatus.BAD_REQUEST,
      );
    }

    session.steps.push({
      id: uuid(),
      stepNumber: session.steps.length + 1,
      type: 'redirected',
      content: `Vendor redirected: "${dto.instruction}"`,
      timestamp: new Date().toISOString(),
    });

    session.messages.push({
      role: 'user',
      content: `[VENDOR GUIDANCE] ${dto.instruction}. Continue the investigation, taking this into account.`,
    });

    await this.sessionStore.save(session);

    return {
      sessionId,
      mode: session.mode,
      status: session.status,
      steps: session.steps,
    };
  }

  /** Get the full investigation session. */
  @Get('investigate/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return {
      sessionId: session.id,
      vendorId: session.vendorId,
      goal: session.goal,
      mode: session.mode,
      isSuperadmin: session.isSuperadmin,
      status: session.status,
      steps: session.steps,
      error: session.error,
      createdAt: session.createdAt,
    };
  }
}

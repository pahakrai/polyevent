import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpException,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { InvestigationService } from './investigation.service';
import { SqlSanitizerInterceptor } from './sql-sanitizer.interceptor';
import type { InvestigationMode } from './investigation.service';

export class InvestigateDto {
  goal!: string;
  vendorId!: string;
  mode?: InvestigationMode; // 'auto' (default) or 'manual'
  role?: string;            // 'superadmin' bypasses vendor scoping (default: scoped)
}

export class RedirectDto {
  instruction!: string;
}

@Controller('agent')
@UseInterceptors(SqlSanitizerInterceptor)
export class AgentController {
  constructor(private readonly investigationService: InvestigationService) {}

  /** Start a new investigation. Mode defaults to 'auto'. Role defaults to scoped vendor. */
  @Post('investigate')
  investigate(@Body() dto: InvestigateDto) {
    if (!dto.goal || !dto.vendorId) {
      throw new HttpException(
        'goal and vendorId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isSuperadmin = dto.role === 'superadmin';

    const session = this.investigationService.startInvestigation(
      dto.vendorId,
      dto.goal,
      dto.mode || 'auto',
      isSuperadmin,
    );

    return {
      sessionId: session.id,
      mode: session.mode,
      isSuperadmin: session.isSuperadmin,
      status: session.status,
      steps: session.steps,
      createdAt: session.createdAt,
    };
  }

  /** Manual mode: advance one ReAct step. Only works when mode='manual'. */
  @Post('investigate/:sessionId/continue')
  async continue(@Param('sessionId') sessionId: string) {
    try {
      const session =
        await this.investigationService.continueInvestigation(sessionId);
      return {
        sessionId: session.id,
        mode: session.mode,
        status: session.status,
        steps: session.steps,
        error: session.error,
      };
    } catch (error) {
      throw new HttpException(
        (error as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Cancel a running investigation. Works for both modes. */
  @Post('investigate/:sessionId/cancel')
  cancel(@Param('sessionId') sessionId: string) {
    try {
      const session = this.investigationService.cancelInvestigation(sessionId);
      return {
        sessionId: session.id,
        mode: session.mode,
        status: session.status,
        steps: session.steps,
        error: session.error,
      };
    } catch (error) {
      throw new HttpException(
        (error as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Vendor provides guidance/redirection mid-investigation. Works for both modes. */
  @Post('investigate/:sessionId/redirect')
  redirect(
    @Param('sessionId') sessionId: string,
    @Body() dto: RedirectDto,
  ) {
    if (!dto.instruction) {
      throw new HttpException(
        'instruction is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const session = this.investigationService.redirectInvestigation(
        sessionId,
        dto.instruction,
      );
      return {
        sessionId: session.id,
        mode: session.mode,
        status: session.status,
        steps: session.steps,
        error: session.error,
      };
    } catch (error) {
      throw new HttpException(
        (error as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Get the full investigation session with all steps. */
  @Get('investigate/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    const session = this.investigationService.getSession(sessionId);
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

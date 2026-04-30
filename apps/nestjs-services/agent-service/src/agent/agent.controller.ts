import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InvestigationService } from './investigation.service';

export class InvestigateDto {
  goal!: string;
  vendorId!: string;
}

export class RedirectDto {
  instruction!: string;
}

@Controller('agent')
export class AgentController {
  constructor(private readonly investigationService: InvestigationService) {}

  /** Start a new investigation. Returns the session with the first step completed. */
  @Post('investigate')
  async investigate(@Body() dto: InvestigateDto) {
    if (!dto.goal || !dto.vendorId) {
      throw new HttpException(
        'goal and vendorId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.investigationService.startInvestigation(
      dto.vendorId,
      dto.goal,
    );

    return {
      sessionId: session.id,
      status: session.status,
      steps: session.steps,
      createdAt: session.createdAt,
    };
  }

  /** Continue to the next step after vendor confirmation */
  @Post('investigate/:sessionId/continue')
  async continue(@Param('sessionId') sessionId: string) {
    try {
      const session =
        await this.investigationService.continueInvestigation(sessionId);
      return {
        sessionId: session.id,
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

  /** Vendor provides guidance/redirection mid-investigation */
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

    try {
      const session = await this.investigationService.redirectInvestigation(
        sessionId,
        dto.instruction,
      );
      return {
        sessionId: session.id,
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

  /** Get the full investigation session with all steps */
  @Get('investigate/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    const session = this.investigationService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return {
      sessionId: session.id,
      vendorId: session.vendorId,
      goal: session.goal,
      status: session.status,
      steps: session.steps,
      error: session.error,
      createdAt: session.createdAt,
    };
  }
}

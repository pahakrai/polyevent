import { Controller, Get, Post, Delete, Req, Res, Param } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://agent-service:3010';

@Controller()
export class AgentProxyController {
  constructor(private readonly httpService: HttpService) {}

  private forward(method: 'get' | 'post' | 'delete', path: string) {
    return async (req: Request, res: Response) => {
      try {
        const url = `${AGENT_SERVICE_URL}${path}`;
        const headers: Record<string, string> = {
          authorization: req.headers.authorization as string,
          'x-user-id': req.headers['x-user-id'] as string,
        };

        if (method === 'delete') {
          const result = await firstValueFrom(this.httpService.delete(url, { headers }));
          return res.status(result.status).json(result.data);
        }

        if (method === 'post') {
          // For multipart uploads, forward raw body with content-type
          if (req.is('multipart/form-data')) {
            headers['content-type'] = req.headers['content-type'] as string;
            const result = await firstValueFrom(
              this.httpService.post(url, req.body, { headers }),
            );
            return res.status(result.status).json(result.data);
          }
          const result = await firstValueFrom(
            this.httpService.post(url, req.body, { headers }),
          );
          return res.status(result.status).json(result.data);
        }

        const result = await firstValueFrom(this.httpService.get(url, { headers }));
        return res.status(result.status).json(result.data);
      } catch (err: unknown) {
        const error = err as AxiosError;
        return res
          .status((error.response?.status as number) || 502)
          .json(error.response?.data || { message: 'Agent service unavailable' });
      }
    };
  }

  // ── Investigation routes ──────────────────────────────────────────────

  @Post('agent/investigate')
  investigate(@Req() r: Request, @Res() res: Response) {
    return this.forward('post', '/agent/investigate')(r, res);
  }

  @Post('agent/investigate/:sessionId/continue')
  continueInvestigation(@Req() r: Request, @Res() res: Response) {
    return this.forward('post', `/agent/investigate/${r.params.sessionId}/continue`)(r, res);
  }

  @Post('agent/investigate/:sessionId/cancel')
  cancelInvestigation(@Req() r: Request, @Res() res: Response) {
    return this.forward('post', `/agent/investigate/${r.params.sessionId}/cancel`)(r, res);
  }

  @Post('agent/investigate/:sessionId/redirect')
  redirectInvestigation(@Req() r: Request, @Res() res: Response) {
    return this.forward('post', `/agent/investigate/${r.params.sessionId}/redirect`)(r, res);
  }

  @Get('agent/investigate/:sessionId')
  getSession(@Req() r: Request, @Res() res: Response) {
    return this.forward('get', `/agent/investigate/${r.params.sessionId}`)(r, res);
  }

  // ── Knowledge Base (RAG) routes ───────────────────────────────────────

  @Post('agent/documents/upload')
  uploadDocument(@Req() r: Request, @Res() res: Response) {
    return this.forward('post', '/agent/documents/upload')(r, res);
  }

  @Get('agent/documents')
  listDocuments(@Req() r: Request, @Res() res: Response) {
    return this.forward('get', '/agent/documents')(r, res);
  }

  @Delete('agent/documents/:id')
  deleteDocument(@Req() r: Request, @Res() res: Response) {
    return this.forward('delete', `/agent/documents/${r.params.id}`)(r, res);
  }

  @Post('agent/chat')
  chat(@Req() r: Request, @Res() res: Response) {
    return this.forward('post', '/agent/chat')(r, res);
  }
}

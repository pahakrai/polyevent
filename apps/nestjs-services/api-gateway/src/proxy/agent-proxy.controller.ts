import { Controller, Get, Post, Delete, Req, Res, Param, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import * as http from 'http';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://agent-service:3010';

@Controller()
export class AgentProxyController {
  private readonly logger = new Logger(AgentProxyController.name);

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

        if (method === 'get') {
          const result = await firstValueFrom(this.httpService.get(url, { headers }));
          return res.status(result.status).json(result.data);
        }

        // POST — dispatch to raw pipe for multipart, axios for JSON
        if (req.is('multipart/form-data')) {
          return this.pipeMultipart(url, headers, req, res);
        }

        const result = await firstValueFrom(
          this.httpService.post(url, req.body, { headers }),
        );
        return res.status(result.status).json(result.data);
      } catch (err: unknown) {
        const error = err as AxiosError;
        return res
          .status((error.response?.status as number) || 502)
          .json(error.response?.data || { message: 'Agent service unavailable' });
      }
    };
  }

  private pipeMultipart(
    url: string,
    baseHeaders: Record<string, string>,
    req: Request,
    res: Response,
  ) {
    const headers: Record<string, string> = {
      ...baseHeaders,
      'content-type': req.headers['content-type'] as string,
    };

    const options: http.RequestOptions = {
      method: 'POST',
      headers,
    };

    const upstreamReq = http.request(url, options, (upstreamRes) => {
      res.status(upstreamRes.statusCode || 200);
      upstreamRes.pipe(res);
    });

    upstreamReq.on('error', (err) => {
      this.logger.error(`Multipart proxy error: ${err.message}`);
      res.status(502).json({ message: 'Agent service unavailable' });
    });

    req.pipe(upstreamReq);
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

  @Post('agent/chat/stream')
  chatStream(@Req() req: Request, @Res() res: Response) {
    const url = `${AGENT_SERVICE_URL}/agent/chat/stream`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const body = JSON.stringify(req.body);

    const options: http.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: req.headers.authorization as string,
        'x-user-id': req.headers['x-user-id'] as string,
        'Content-Length': Buffer.byteLength(body).toString(),
      },
    };

    const upstreamReq = http.request(url, options, (upstreamRes) => {
      upstreamRes.pipe(res);
    });

    upstreamReq.on('error', (err) => {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    });

    upstreamReq.write(body);
    upstreamReq.end();
  }
}

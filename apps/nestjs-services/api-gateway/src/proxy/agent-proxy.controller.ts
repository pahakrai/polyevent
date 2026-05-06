import { Controller, Get, Post, Req, Res, Param, Body } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://agent-service:3010';

@Controller()
export class AgentProxyController {
  constructor(private readonly httpService: HttpService) {}

  private send(method: 'get' | 'post', path: string) {
    return async (req: Request, res: Response) => {
      try {
        const url = `${AGENT_SERVICE_URL}${path}`;
        const headers = {
          authorization: req.headers.authorization,
          'x-user-id': req.headers['x-user-id'],
        };
        const result =
          method === 'post'
            ? await firstValueFrom(this.httpService.post(url, req.body, { headers }))
            : await firstValueFrom(this.httpService.get(url, { headers }));
        return res.status(result.status).json(result.data);
      } catch (err: unknown) {
        const error = err as AxiosError;
        return res
          .status((error.response?.status as number) || 502)
          .json(error.response?.data || { message: 'Agent service unavailable' });
      }
    };
  }

  @Post('agent/investigate')
  investigate(@Req() r: Request, @Res() res: Response) {
    return this.send('post', '/agent/investigate')(r, res);
  }

  @Post('agent/investigate/:sessionId/continue')
  continueInvestigation(@Req() r: Request, @Res() res: Response) {
    return this.send('post', `/agent/investigate/${r.params.sessionId}/continue`)(r, res);
  }

  @Post('agent/investigate/:sessionId/redirect')
  redirectInvestigation(@Req() r: Request, @Res() res: Response) {
    return this.send('post', `/agent/investigate/${r.params.sessionId}/redirect`)(r, res);
  }

  @Get('agent/investigate/:sessionId')
  getSession(@Req() r: Request, @Res() res: Response) {
    return this.send('get', `/agent/investigate/${r.params.sessionId}`)(r, res);
  }
}

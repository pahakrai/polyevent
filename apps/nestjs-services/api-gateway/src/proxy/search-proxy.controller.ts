import { Controller, All, Req, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'http://search-service:3060';

@Controller('search')
export class SearchProxyController {
  constructor(private readonly httpService: HttpService) {}

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    try {
      const url = `${SEARCH_SERVICE_URL}/search${req.url.replace('/search', '')}`;
      const config = {
        headers: { authorization: req.headers.authorization },
        params: req.query,
      };
      const result = await firstValueFrom(
        this.httpService.request({
          method: req.method as any,
          url,
          data: req.body,
          ...config,
        }),
      );
      return res.status(result.status).json(result.data);
    } catch (err: unknown) {
      const error = err as AxiosError;
      return res
        .status((error.response?.status as number) || 502)
        .json(error.response?.data || { message: 'Service unavailable' });
    }
  }
}

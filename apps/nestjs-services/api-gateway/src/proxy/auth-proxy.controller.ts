import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3000';

@Controller('auth')
export class AuthProxyController {
  constructor(private readonly httpService: HttpService) {}

  @Post('register')
  async register(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await firstValueFrom(
        this.httpService.post(`${AUTH_SERVICE_URL}/auth/register`, req.body),
      );
      return res.status(result.status).json(result.data);
    } catch (err: unknown) {
      const error = err as AxiosError;
      return res.status((error.response?.status as number) || 502).json(error.response?.data || { message: 'Service unavailable' });
    }
  }

  @Post('login')
  async login(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await firstValueFrom(
        this.httpService.post(`${AUTH_SERVICE_URL}/auth/login`, req.body),
      );
      return res.status(result.status).json(result.data);
    } catch (err: unknown) {
      const error = err as AxiosError;
      return res.status((error.response?.status as number) || 502).json(error.response?.data || { message: 'Service unavailable' });
    }
  }

  @Get('profile')
  async profile(@Req() req: Request, @Res() res: Response) {
    try {
      const result = await firstValueFrom(
        this.httpService.get(`${AUTH_SERVICE_URL}/auth/profile`, {
          headers: { authorization: req.headers.authorization },
        }),
      );
      return res.status(result.status).json(result.data);
    } catch (err: unknown) {
      const error = err as AxiosError;
      return res.status((error.response?.status as number) || 502).json(error.response?.data || { message: 'Service unavailable' });
    }
  }
}

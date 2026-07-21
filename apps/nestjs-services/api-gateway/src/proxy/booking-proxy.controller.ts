import { Controller, All, Req, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3007';

@Controller('bookings')
export class BookingProxyController {
  constructor(private readonly httpService: HttpService) {}

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    try {
      const url = `${BOOKING_SERVICE_URL}/bookings${req.url.replace('/bookings', '')}`;
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

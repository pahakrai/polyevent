import { Controller, Get, Post, Patch, Req, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://event-service:3000';

@Controller()
export class EventProxyController {
  constructor(private readonly httpService: HttpService) {}

  private async proxy(method: 'get' | 'post' | 'patch', path: string, req: Request, res: Response) {
    try {
      const url = `${EVENT_SERVICE_URL}${path}`;
      const headers = { authorization: req.headers.authorization, 'x-user-id': req.headers['x-user-id'] };
      let result;
      if (method === 'patch') {
        result = await firstValueFrom(this.httpService.patch(url, req.body, { headers }));
      } else if (method === 'post') {
        result = await firstValueFrom(this.httpService.post(url, req.body, { headers }));
      } else {
        result = await firstValueFrom(this.httpService.get(url, { headers, params: req.query }));
      }
      return res.status(result.status).json(result.data);
    } catch (err: unknown) {
      const error = err as AxiosError;
      return res.status((error.response?.status as number) || 502).json(error.response?.data || { message: 'Service unavailable' });
    }
  }

  @Get('events')                      getEvents(@Req() r: Request, @Res() res: Response) { return this.proxy('get', '/events', r, res); }
  @Get('events/search')              searchEvents(@Req() r: Request, @Res() res: Response) { return this.proxy('get', '/events/search', r, res); }
  @Get('events/category/:category')  eventsByCategory(@Req() r: Request, @Res() res: Response) { return this.proxy('get', `/events/category/${r.params.category}`, r, res); }
  @Get('events/nearby')              eventsNearby(@Req() r: Request, @Res() res: Response) { return this.proxy('get', '/events/nearby', r, res); }
  @Get('events/vendor/:vendorId')    eventsByVendor(@Req() r: Request, @Res() res: Response) { return this.proxy('get', `/events/vendor/${r.params.vendorId}`, r, res); }
  @Get('events/:id')                 getEvent(@Req() r: Request, @Res() res: Response) { return this.proxy('get', `/events/${r.params.id}`, r, res); }
  @Post('events')                    createEvent(@Req() r: Request, @Res() res: Response) { return this.proxy('post', '/events', r, res); }
  @Patch('events/:id')               updateEvent(@Req() r: Request, @Res() res: Response) { return this.proxy('patch', `/events/${r.params.id}`, r, res); }
  @Post('events/:id/publish')        publishEvent(@Req() r: Request, @Res() res: Response) { return this.proxy('post', `/events/${r.params.id}/publish`, r, res); }
  @Post('events/:id/cancel')         cancelEvent(@Req() r: Request, @Res() res: Response) { return this.proxy('post', `/events/${r.params.id}/cancel`, r, res); }
}

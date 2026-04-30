import { Controller, Get, Post, Patch, Delete, Req, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const VENDOR_SERVICE_URL = process.env.VENDOR_SERVICE_URL || 'http://vendor-service:3000';

@Controller()
export class VendorProxyController {
  constructor(private readonly httpService: HttpService) {}

  private send(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return async (req: Request, res: Response) => {
      try {
        const url = `${VENDOR_SERVICE_URL}${path}`;
        const headers = { authorization: req.headers.authorization, 'x-user-id': req.headers['x-user-id'] };
        let result;
        if (method === 'delete') {
          result = await firstValueFrom(this.httpService.delete(url, { headers }));
        } else if (method === 'patch') {
          result = await firstValueFrom(this.httpService.patch(url, req.body, { headers }));
        } else if (method === 'post') {
          result = await firstValueFrom(this.httpService.post(url, req.body, { headers }));
        } else {
          result = await firstValueFrom(this.httpService.get(url, { headers }));
        }
        return res.status(result.status).json(result.data);
      } catch (err: unknown) {
        const error = err as AxiosError;
        return res.status((error.response?.status as number) || 502).json(error.response?.data || { message: 'Service unavailable' });
      }
    };
  }

  // Vendors
  @Post('vendors')           postVendors(@Req() r: Request, @Res() res: Response) { return this.send('post', '/vendors')(r, res); }
  @Get('vendors')            getVendors(@Req() r: Request, @Res() res: Response) { return this.send('get', '/vendors')(r, res); }
  @Get('vendors/user/:userId') getVendorByUser(@Req() r: Request, @Res() res: Response) { return this.send('get', `/vendors/user/${r.params.userId}`)(r, res); }
  @Get('vendors/:id')        getVendor(@Req() r: Request, @Res() res: Response) { return this.send('get', `/vendors/${r.params.id}`)(r, res); }
  @Patch('vendors/:id')      patchVendor(@Req() r: Request, @Res() res: Response) { return this.send('patch', `/vendors/${r.params.id}`)(r, res); }
  @Post('vendors/:id/verify') verifyVendor(@Req() r: Request, @Res() res: Response) { return this.send('post', `/vendors/${r.params.id}/verify`)(r, res); }
  @Get('vendors/:id/stats')  getVendorStats(@Req() r: Request, @Res() res: Response) { return this.send('get', `/vendors/${r.params.id}/stats`)(r, res); }

  // Venues
  @Post('vendors/:vendorId/venues') postVenue(@Req() r: Request, @Res() res: Response) { return this.send('post', `/vendors/${r.params.vendorId}/venues`)(r, res); }
  @Get('vendors/:vendorId/venues')  getVenues(@Req() r: Request, @Res() res: Response) { return this.send('get', `/vendors/${r.params.vendorId}/venues`)(r, res); }
  @Get('venues/:id')           getVenue(@Req() r: Request, @Res() res: Response) { return this.send('get', `/venues/${r.params.id}`)(r, res); }
  @Patch('venues/:id')         patchVenue(@Req() r: Request, @Res() res: Response) { return this.send('patch', `/venues/${r.params.id}`)(r, res); }
  @Delete('venues/:id')        deleteVenue(@Req() r: Request, @Res() res: Response) { return this.send('delete', `/venues/${r.params.id}`)(r, res); }

  // Timeslots
  @Post('venues/:venueId/timeslots')      postTimeslot(@Req() r: Request, @Res() res: Response) { return this.send('post', `/venues/${r.params.venueId}/timeslots`)(r, res); }
  @Post('venues/:venueId/timeslots/bulk') postBulkTimeslots(@Req() r: Request, @Res() res: Response) { return this.send('post', `/venues/${r.params.venueId}/timeslots/bulk`)(r, res); }
  @Get('venues/:venueId/timeslots')       getTimeslots(@Req() r: Request, @Res() res: Response) { return this.send('get', `/venues/${r.params.venueId}/timeslots`)(r, res); }
  @Get('timeslots/:id')        getTimeslot(@Req() r: Request, @Res() res: Response) { return this.send('get', `/timeslots/${r.params.id}`)(r, res); }
  @Patch('timeslots/:id')      patchTimeslot(@Req() r: Request, @Res() res: Response) { return this.send('patch', `/timeslots/${r.params.id}`)(r, res); }
  @Delete('timeslots/:id')     deleteTimeslot(@Req() r: Request, @Res() res: Response) { return this.send('delete', `/timeslots/${r.params.id}`)(r, res); }
  @Post('timeslots/:id/block') blockTimeslot(@Req() r: Request, @Res() res: Response) { return this.send('post', `/timeslots/${r.params.id}/block`)(r, res); }
}

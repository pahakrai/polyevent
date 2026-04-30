import { Controller, Get, Post, Patch, Delete, Req, Res } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3000';

@Controller()
export class UserProxyController {
  constructor(private readonly httpService: HttpService) {}

  private async proxy(method: 'get' | 'post' | 'patch' | 'delete', path: string, req: Request, res: Response) {
    try {
      const url = `${USER_SERVICE_URL}${path}`;
      const headers = { authorization: req.headers.authorization, 'x-user-id': req.headers['x-user-id'] };
      let result;
      if (method === 'delete') {
        result = await firstValueFrom(this.httpService.delete(url, { headers }));
      } else if (method === 'patch') {
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

  // Users
  @Get('users/profile')   getUserProfile(@Req() r: Request, @Res() res: Response) { return this.proxy('get', '/users/profile', r, res); }
  @Get('users/:id')        getUser(@Req() r: Request, @Res() res: Response) { return this.proxy('get', `/users/${r.params.id}`, r, res); }
  @Patch('users/profile')  updateUserProfile(@Req() r: Request, @Res() res: Response) { return this.proxy('patch', '/users/profile', r, res); }

  // Groups
  @Post('groups')                        createGroup(@Req() r: Request, @Res() res: Response) { return this.proxy('post', '/groups', r, res); }
  @Get('groups')                         getGroups(@Req() r: Request, @Res() res: Response) { return this.proxy('get', '/groups', r, res); }
  @Get('groups/user/:userId')            getGroupsByUser(@Req() r: Request, @Res() res: Response) { return this.proxy('get', `/groups/user/${r.params.userId}`, r, res); }
  @Get('groups/:id')                     getGroup(@Req() r: Request, @Res() res: Response) { return this.proxy('get', `/groups/${r.params.id}`, r, res); }
  @Patch('groups/:id')                   updateGroup(@Req() r: Request, @Res() res: Response) { return this.proxy('patch', `/groups/${r.params.id}`, r, res); }
  @Delete('groups/:id')                  deleteGroup(@Req() r: Request, @Res() res: Response) { return this.proxy('delete', `/groups/${r.params.id}`, r, res); }
  @Post('groups/:id/join')               joinGroup(@Req() r: Request, @Res() res: Response) { return this.proxy('post', `/groups/${r.params.id}/join`, r, res); }
  @Post('groups/:id/leave')              leaveGroup(@Req() r: Request, @Res() res: Response) { return this.proxy('post', `/groups/${r.params.id}/leave`, r, res); }
  @Post('groups/:id/members/:userId')    addGroupMember(@Req() r: Request, @Res() res: Response) { return this.proxy('post', `/groups/${r.params.id}/members/${r.params.userId}`, r, res); }
  @Delete('groups/:id/members/:userId')  removeGroupMember(@Req() r: Request, @Res() res: Response) { return this.proxy('delete', `/groups/${r.params.id}/members/${r.params.userId}`, r, res); }
}

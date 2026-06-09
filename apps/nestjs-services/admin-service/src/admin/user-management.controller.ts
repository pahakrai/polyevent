import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { AuditService } from './audit.service';

@ApiTags('admin/users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/users')
export class UserManagementController {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get url() {
    return this.config.get<string>('USER_SERVICE_URL') || 'http://user-service:3000';
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (proxied to user-service)' })
  async getOne(@Param('id') id: string) {
    const { data } = await firstValueFrom(this.http.get(`${this.url}/users/${id}`));
    return data;
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role (note: requires user-service support)' })
  async updateRole(@Param('id') id: string, @Body('role') role: string, @Req() req: Request) {
    const admin = (req as any).user;
    await this.audit.log(admin.sub, 'UPDATE_ROLE', 'user', id, { role });
    // User-service does not yet expose a role update endpoint — log only for now
    return { id, role, status: 'logged', note: 'User-service role update endpoint not yet implemented' };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Enable/disable user (note: requires user-service support)' })
  async updateStatus(@Param('id') id: string, @Body('isActive') isActive: boolean, @Req() req: Request) {
    const admin = (req as any).user;
    await this.audit.log(admin.sub, isActive ? 'ENABLE' : 'DISABLE', 'user', id);
    return { id, isActive, status: 'logged', note: 'User-service status endpoint not yet implemented' };
  }
}

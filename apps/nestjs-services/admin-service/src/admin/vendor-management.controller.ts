import { Controller, Get, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { AuditService } from './audit.service';

@ApiTags('admin/vendors')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin/vendors')
export class VendorManagementController {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get url() {
    return this.config.get<string>('VENDOR_SERVICE_URL') || 'http://vendor-service:3000';
  }

  @Get()
  @ApiOperation({ summary: 'List all vendors (proxied to vendor-service)' })
  async listAll() {
    const { data } = await firstValueFrom(this.http.get(`${this.url}/vendors`));
    return data;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID (proxied to vendor-service)' })
  async getOne(@Param('id') id: string) {
    const { data } = await firstValueFrom(this.http.get(`${this.url}/vendors/${id}`));
    return data;
  }

  @Patch(':id/verify')
  @ApiOperation({ summary: 'Verify/unverify vendor (proxied to vendor-service)' })
  async verify(@Param('id') id: string, @Body('isVerified') isVerified: boolean, @Req() req: Request) {
    const admin = (req as any).user;
    await this.audit.log(admin.sub, isVerified ? 'VERIFY' : 'UNVERIFY', 'vendor', id);
    // vendor-service already has POST /vendors/:id/verify with ADMIN guard
    const { data } = await firstValueFrom(this.http.post(`${this.url}/vendors/${id}/verify`, { isVerified }));
    return data;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vendor (proxied to vendor-service)' })
  async update(@Param('id') id: string, @Body() dto: any, @Req() req: Request) {
    const admin = (req as any).user;
    await this.audit.log(admin.sub, 'UPDATE', 'vendor', id, dto);
    const { data } = await firstValueFrom(this.http.patch(`${this.url}/vendors/${id}`, dto));
    return data;
  }
}

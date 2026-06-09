import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Aggregated dashboard stats' })
  dashboard(@Query() query: DashboardQueryDto) {
    return this.adminService.getDashboard(query.period);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Generate reports (financial, users, events, vendors)' })
  reports(@Query('type') type: string, @Query('period') period: string = 'month') {
    return this.adminService.getReports(type, period);
  }

  @Post('maintenance')
  @ApiOperation({ summary: 'Toggle maintenance mode' })
  maintenance(@Body('enabled') enabled: boolean) {
    return this.adminService.setMaintenanceMode(enabled);
  }
}

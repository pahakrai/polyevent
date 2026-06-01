import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ConfigService } from '../config/config.service';

@Controller('admin/config')
export class AdminConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  async listAll() {
    return this.config.listAll();
  }

  @Patch()
  async update(
    @Body('key') key: string,
    @Body('value') value: any,
    @Body('updatedBy') updatedBy?: string,
  ) {
    return this.config.set(key as any, value, updatedBy);
  }
}

import {
  Controller, Post, Get, Patch, Body, Param, UseGuards, Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send an immediate notification' })
  send(@Body() dto: SendNotificationDto) {
    return this.notificationService.send(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  findByUser(@Query('userId') userId: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.notificationService.findByUser(userId, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(id);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a notification template' })
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.notificationService.createTemplate(dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List all templates' })
  listTemplates() {
    return this.notificationService.listTemplates();
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update a template' })
  updateTemplate(@Param('id') id: string, @Body() dto: CreateTemplateDto) {
    return this.notificationService.updateTemplate(id, dto);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  getPreferences(@Query('userId') userId: string) {
    return this.notificationService.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(@Query('userId') userId: string, @Body() dto: UpdatePreferencesDto) {
    return this.notificationService.updatePreferences(userId, dto);
  }
}

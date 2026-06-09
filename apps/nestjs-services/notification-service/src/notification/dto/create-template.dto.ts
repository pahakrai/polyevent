import { IsString, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel } from './send-notification.dto';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Template name (unique identifier)' })
  @IsString()
  name: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Subject line with {{placeholders}}' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Body text with {{placeholders}}' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'List of variable names used in template' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @ApiPropertyOptional({ description: 'Whether the template is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

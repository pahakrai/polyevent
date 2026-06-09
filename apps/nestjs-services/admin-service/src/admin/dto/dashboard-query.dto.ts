import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month', 'year'], default: 'month' })
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'])
  period?: string = 'month';
}

import {
  IsString,
  IsOptional,
  IsIn,
  IsObject,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateEventTypeDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER'])
  category?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsObject()
  @IsOptional()
  attributesSchema?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  allowRsvp?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsIn,
  IsObject,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateEventTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER'])
  category: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsObject()
  @IsOptional()
  attributesSchema?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  allowRsvp?: boolean;
}

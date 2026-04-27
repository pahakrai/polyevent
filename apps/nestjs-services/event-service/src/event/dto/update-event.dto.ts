import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsDateString,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsObject()
  @IsOptional()
  location?: Record<string, any>;

  @IsObject()
  @IsOptional()
  price?: Record<string, any>;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxAttendees?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsInt()
  @IsOptional()
  ageRestriction?: number;
}

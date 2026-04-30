import { IsString, IsOptional, IsInt, IsArray, IsNumber, Min, IsBoolean } from 'class-validator';

export class UpdateVenueDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsOptional()
  address?: Record<string, any>;

  @IsOptional()
  location?: Record<string, any>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  amenities?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  pricingModel?: string;

  @IsNumber()
  @IsOptional()
  hourlyRate?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}

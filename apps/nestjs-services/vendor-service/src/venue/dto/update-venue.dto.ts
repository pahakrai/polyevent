import { IsString, IsOptional, IsInt, IsArray, IsNumber, Min, IsBoolean, IsIn } from 'class-validator';

export class UpdateVenueDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['INDOOR', 'OUTDOOR', 'STUDIO', 'GALLERY', 'FIELD', 'COURT', 'OTHER'])
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
  @IsIn(['FREE', 'PER_HOUR', 'CONTRACT', 'MIXED'])
  pricingModel?: string;

  @IsNumber()
  @IsOptional()
  hourlyRate?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}

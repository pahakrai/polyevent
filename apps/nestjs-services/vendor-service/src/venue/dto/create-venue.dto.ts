import { IsString, IsOptional, IsInt, IsArray, IsNumber, Min, IsIn, IsNotEmpty } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['INDOOR', 'OUTDOOR', 'STUDIO', 'GALLERY', 'FIELD', 'COURT', 'OTHER'])
  type: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsNotEmpty()
  address: Record<string, any>;

  @IsNotEmpty()
  location: Record<string, any>;

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
}

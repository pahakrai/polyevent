import { IsString, IsOptional, IsInt, IsArray, IsNumber, Min, IsNotEmpty } from 'class-validator';

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
  pricingModel?: string;

  @IsNumber()
  @IsOptional()
  hourlyRate?: number;
}

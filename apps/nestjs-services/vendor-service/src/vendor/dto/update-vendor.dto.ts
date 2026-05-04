import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  businessName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER'])
  category?: string;

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsString()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsOptional()
  address?: Record<string, any>;

  @IsOptional()
  location?: Record<string, any>;

  @IsString()
  @IsOptional()
  coverImage?: string;
}

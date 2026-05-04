import { IsString, IsOptional, IsNotEmpty, IsIn, MaxLength } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER'])
  category: string;

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsString()
  @IsNotEmpty()
  contactEmail: string;

  @IsString()
  @IsNotEmpty()
  contactPhone: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsNotEmpty()
  address: Record<string, any>;

  @IsNotEmpty()
  location: Record<string, any>;

  @IsString()
  @IsOptional()
  coverImage?: string;
}

import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

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

  @IsOptional()
  address: Record<string, any>;

  @IsOptional()
  location: Record<string, any>;

  @IsString()
  @IsOptional()
  coverImage?: string;
}

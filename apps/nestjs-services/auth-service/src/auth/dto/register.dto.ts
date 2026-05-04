import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
  IsNotEmpty,
  ValidateIf,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class VendorFieldsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['MUSIC', 'ART', 'SPORTS', 'ACTIVITIES', 'OTHER'])
  category!: string;

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsEmail()
  @IsNotEmpty()
  contactEmail!: string;

  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsNotEmpty()
  address!: Record<string, any>;

  @IsNotEmpty()
  location!: Record<string, any>;

  @IsString()
  @IsOptional()
  coverImage?: string;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsIn(['USER', 'VENDOR', 'ADMIN'])
  @IsOptional()
  role?: string;

  @ValidateIf((o) => o.role === 'VENDOR')
  @ValidateNested()
  @Type(() => VendorFieldsDto)
  vendor?: VendorFieldsDto;
}

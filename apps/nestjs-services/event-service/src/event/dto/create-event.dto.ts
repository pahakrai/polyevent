import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  IsDateString,
  IsObject,
  IsNotEmpty,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @IsString()
  @IsOptional()
  venueId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsObject()
  location: {
    venueName?: string;
    name?: string;
    address?: string;
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lon?: number;
    lng?: number;
  };

  @IsObject()
  price: {
    minPrice?: number;
    maxPrice?: number;
    price?: number;
    currency?: string;
  };

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

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsString()
  @IsOptional()
  recurringRule?: string;
}

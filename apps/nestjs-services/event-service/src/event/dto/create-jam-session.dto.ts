import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsDateString,
  IsObject,
  IsNotEmpty,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateJamSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

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

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  instrumentsWanted: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  genres?: string[];

  @IsInt()
  @Min(2)
  @IsOptional()
  maxParticipants?: number;

  @IsString()
  @IsOptional()
  groupId?: string;
}

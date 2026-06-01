import { IsString, IsOptional, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MusicianProfileFieldsDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  instruments?: string[];

  @IsString()
  @IsOptional()
  skillLevel?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  genres?: string[];

  @IsString()
  @IsOptional()
  intent?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  lookingFor?: string[];

  @IsString()
  @IsOptional()
  bio?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  influences?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  availableDays?: string[];
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[];

  @IsObject()
  @IsOptional()
  location?: Record<string, any>;

  @IsObject()
  @IsOptional()
  preferences?: Record<string, any>;

  @ValidateNested()
  @Type(() => MusicianProfileFieldsDto)
  @IsOptional()
  musicianProfile?: MusicianProfileFieldsDto;
}

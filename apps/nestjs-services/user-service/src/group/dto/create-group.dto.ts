import { IsString, IsOptional, IsInt, IsBoolean, IsArray, IsNotEmpty, Min, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(2)
  @IsOptional()
  maxMembers?: number;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interests?: string[];
}

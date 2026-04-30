import { IsString, IsOptional, IsInt, IsDateString, IsObject, Min, IsNotEmpty } from 'class-validator';

export class CreateTimeslotDto {
  @IsString()
  @IsNotEmpty()
  venueId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  recurrenceRule?: string;

  @IsObject()
  @IsOptional()
  priceOverride?: { amount: number; currency: string };

  @IsInt()
  @Min(1)
  @IsOptional()
  maxBookings?: number;
}

export class BulkCreateTimeslotDto {
  @IsString()
  @IsNotEmpty()
  venueId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsInt({ each: true })
  daysOfWeek: number[];

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsObject()
  @IsOptional()
  priceOverride?: { amount: number; currency: string };
}

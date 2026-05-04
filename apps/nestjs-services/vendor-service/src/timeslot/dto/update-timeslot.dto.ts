import { IsString, IsOptional, IsInt, IsDateString, IsObject, Min, IsIn } from 'class-validator';

export class UpdateTimeslotDto {
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  @IsIn(['AVAILABLE', 'BOOKED', 'BLOCKED', 'MAINTENANCE'])
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

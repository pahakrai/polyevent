import { IsString, IsNotEmpty } from 'class-validator';
import { CreateVendorDto } from './create-vendor.dto';

export class CreateInternalVendorDto extends CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

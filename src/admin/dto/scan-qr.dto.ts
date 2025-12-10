// src/admin/dto/scan-qr.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ScanQrDto {
  @IsString()
  @IsNotEmpty()
  qrValue: string; // valor leído del QR (email / matrícula / id / token)

  @IsOptional()
  @Type(() => Number)
  workshopId?: number; // id del taller / evento seleccionado en el front

  @IsOptional()
  @Type(() => Number)
  scheduleId?: number; // opcional, si seleccionas un horario concreto (por ahora no se guarda en BD)
}

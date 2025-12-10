import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserActivationDto {
  @ApiProperty({ example: true, description: 'Activar (true) o desactivar (false) las funciones del evento' })
  @IsBoolean()
  activate: boolean;

  @ApiProperty({ example: false, required: false, description: 'Forzar activación aunque no tenga pago válido (solo admin)' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiProperty({ example: 'Pago verificado manualmente', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

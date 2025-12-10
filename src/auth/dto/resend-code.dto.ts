// resend-code.dto.ts - VERSIÓN MEJORADA
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResendCodeDto {
  /** User email */
  @ApiProperty({ example: 'user@example.com', description: 'User email to resend verification code' })
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  public email: string;
}
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, Length, IsIn, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

// verify-code.dto.ts
export class VerifyCodeDto {
  @ApiProperty({ example: 'user@example.com', description: 'Correo del usuario' })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: '123456', description: 'Código de 6 dígitos' })
  @Length(6, 6, { message: 'El código debe tener 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'El código debe ser numérico' })
  code: string;

  @ApiPropertyOptional({ 
    enum: ['email_verification', 'reset_password'], 
    description: 'Tipo de verificación',
    default: 'email_verification'
  })
  @IsOptional()
  @IsIn(['email_verification', 'reset_password'])
  token_type?: 'email_verification' | 'reset_password' = 'email_verification';
}
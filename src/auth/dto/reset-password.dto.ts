import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Length, Matches, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Correo del usuario' })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'NewPassword123!',
    description: 'Nueva contraseña (8–50 caracteres, con mayúscula, minúscula, número y símbolo; sin espacios)',
    minLength: 8,
    maxLength: 50,
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @Length(8, 50, { message: 'La contraseña debe tener entre 8 y 50 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/, {
    message: 'La contraseña debe incluir mayúscula, minúscula, número y símbolo',
  })
  @Matches(/^\S+$/, { message: 'La contraseña no puede contener espacios' })
  password: string;

  @ApiProperty({
    example: '123456',
    description: 'Código de verificación de 6 dígitos para restablecer contraseña',
  })
  @IsString({ message: 'El código debe ser texto' })
  @Transform(({ value }) => (value ?? '').toString().replace(/\D/g, '').trim())
  @Matches(/^\d{6}$/, { message: 'El código debe tener exactamente 6 dígitos' })
  code: string;
}

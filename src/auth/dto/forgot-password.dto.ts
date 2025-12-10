import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Correo del usuario que solicita recuperación',
  })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}

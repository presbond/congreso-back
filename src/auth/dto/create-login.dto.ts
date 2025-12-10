import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, MinLength } from 'class-validator'; 
import { Transform } from 'class-transformer';

export class CreateLoginDto {
  
  /** User email */
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail({}, { message: 'El email debe ser válido' }) // Validates that the email is correct
  @IsNotEmpty({ message: 'El email es obligatorio' }) // Ensures that the email is not empty
  @Transform(({ value }) => value?.toLowerCase().trim()) // Normalizes the email to lowercase and removes extra spaces
  public email: string;

  /** User password */
  @ApiProperty({ example: '#Duck123!', description: 'User password' })
  @IsString({ message: 'La contraseña debe ser texto' }) // Ensures the password is a string
  @IsNotEmpty({ message: 'La contraseña es obligatoria' }) // Ensures that the password is not empty
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) // Ensures the password has a minimum length
  public password: string;
}

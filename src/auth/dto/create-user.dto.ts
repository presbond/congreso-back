// src/auth/dto/create-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsEmail,
  MaxLength,
  MinLength,
  IsOptional,
  IsUrl,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { size_enum } from '@prisma/client';

// Enums para valores específicos que coinciden con tu frontend
export enum EducationalProgram {
  TI = 'TI',
  MCC = 'MCC',
  AAK = 'AAK',
  II = 'II',
  MI = 'MI',
  ASP = 'ASP',
  NEG = 'NEG',
  CONT = 'CONT'
}

export enum Provenance {
  UTTECAM = 'uttecam',
  OTRA = 'otra'
}

export enum PresentationType {
  CONFERENCIA = 'conferencia',
  TALLER = 'taller',
  AMBAS = 'ambas'
}

export class CreateUserDto {
  // ===================================
  // CAMPOS OBLIGATORIOS PARA TODOS LOS USUARIOS
  // ===================================

  @ApiProperty({ example: 'Jony', description: 'Nombre del usuario' })
  @IsString({ message: 'El nombre debe ser texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre es demasiado largo' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' '))
  name_user: string;

  @ApiProperty({ example: 'Smith', description: 'Apellido paterno del usuario' })
  @IsString({ message: 'El apellido paterno debe ser texto' })
  @IsNotEmpty({ message: 'El apellido paterno es obligatorio' })
  @MaxLength(100, { message: 'El apellido paterno es demasiado largo' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' '))
  paternal_surname: string;

  @ApiProperty({ example: 'Williams', description: 'Apellido materno del usuario' })
  @IsString({ message: 'El apellido materno debe ser texto' })
  @IsNotEmpty({ message: 'El apellido materno es obligatorio' })
  @MaxLength(100, { message: 'El apellido materno es demasiado largo' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' '))
  maternal_surname: string;

  @ApiProperty({ example: '+525512345678', description: 'Teléfono del usuario en formato E.164' })
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/\s|-/g, '') : value)
  @IsString({ message: 'El teléfono debe ser texto' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  phone: string;

  @ApiProperty({ example: '+15551234567', description: 'Teléfono de emergencia (opcional)', required: false })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.replace(/\s|-/g, '').trim();
    return v === '' ? undefined : v;
  })
  @IsOptional()
  @IsString({ message: 'El teléfono de emergencia debe ser texto' })
  emergency_phone?: string;

  @ApiProperty({ example: 'example@gmail.com', description: 'Correo electrónico del usuario' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @IsEmail({}, { message: 'El email no es válido' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: '#Duck123', description: 'Contraseña del usuario' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password_user: string;

  @ApiProperty({ example: 1, description: 'ID del tipo de usuario' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El tipo de usuario debe ser un número' })
  @IsNotEmpty({ message: 'El tipo de usuario es obligatorio' })
  type_user_id: number;

  @ApiProperty({ example: 'M', enum: ['S', 'M', 'L', 'XL', 'XXL'], description: 'Talla seleccionada' })
  @IsNotEmpty({ message: 'La talla es obligatoria' })
  @IsString({ message: 'La talla debe ser texto' })
  size_user: string;

  // ===================================
  // CAMPOS PARA ESTUDIANTES Y MAESTROS (1, 2)
  // ===================================

  @ApiProperty({ example: 'uttecam', description: 'Procedencia del usuario', required: false })
  @IsOptional()
  @IsString({ message: 'La procedencia debe ser texto' })
  @MaxLength(255, { message: 'La procedencia es demasiado larga' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  provenance?: string;

  // Campos para UTTECAM
  @ApiProperty({ example: '12345678', description: 'Matrícula para UTTECAM', required: false })
  @IsOptional()
  @IsString({ message: 'La matrícula debe ser texto' })
  @MaxLength(20, { message: 'La matrícula es demasiado larga' })
  matricula?: string;

  @ApiProperty({ example: 'TI', enum: EducationalProgram, description: 'Programa educativo para UTTECAM', required: false })
  @IsOptional()
  @IsEnum(EducationalProgram, {
    message: 'El programa educativo debe ser uno de los valores válidos'
  })
  @IsString({ message: 'El programa educativo debe ser texto' })
  @MaxLength(155, { message: 'El programa educativo es demasiado largo' })
  educational_program?: string;

  @ApiProperty({ example: '7', description: 'Grado para estudiantes UTTECAM', required: false })
  @IsOptional()
  @IsString({ message: 'El grado debe ser texto' })
  @MaxLength(5, { message: 'El grado es demasiado largo' })
  grade?: string;

  @ApiProperty({ example: 'A', description: 'Grupo para estudiantes UTTECAM', required: false })
  @IsOptional()
  @IsString({ message: 'El grupo debe ser texto' })
  @MaxLength(5, { message: 'El grupo es demasiado largo' })
  group_user?: string;

  // Campo para otra universidad
  @ApiProperty({ example: 'Otra Universidad', description: 'Universidad de procedencia', required: false })
  @IsOptional()
  @IsString({ message: 'La universidad de procedencia debe ser texto' })
  @MaxLength(255, { message: 'La universidad de procedencia es demasiado larga' })
  universidad_procedencia?: string;

  // ===================================
  // CAMPOS PARA PONENTES (4)
  // ===================================

  @ApiProperty({ example: 'ponente2024', description: 'Contraseña secreta para ponentes', required: false })
  @IsOptional()
  @IsString({ message: 'La contraseña secreta debe ser texto' })
  secret_password?: string;

  @ApiProperty({ example: 'Mi Empresa SA', description: 'Empresa de procedencia', required: false })
  @IsOptional()
  @IsString({ message: 'La empresa de procedencia debe ser texto' })
  @MaxLength(100, { message: 'La empresa de procedencia es demasiado larga' })
  empresa_procedencia?: string;

  @ApiProperty({ example: 'CEO', description: 'Rol en la empresa', required: false })
  @IsOptional()
  @IsString({ message: 'El rol en la empresa debe ser texto' })
  @MaxLength(100, { message: 'El rol en la empresa es demasiado largo' })
  rol_dentro_empresa?: string;

  @ApiProperty({ example: 'Biografía profesional...', description: 'Biografía del ponente', required: false })
  @IsOptional()
  @IsString({ message: 'La biografía debe ser texto' })
  @MaxLength(180, { message: 'La biografía es demasiado larga' })
  descripcion_biografia?: string;

  @ApiProperty({ example: 'conferencia', enum: ['conferencia', 'taller', 'ambas'], description: 'Tipo de presentación', required: false })
  @IsOptional()
  @IsString({ message: 'El tipo de presentación debe ser texto' })
  tipo_presentacion?: string;

  @ApiProperty({ example: 'Título de conferencia', description: 'Título de la conferencia', required: false })
  @IsOptional()
  @IsString({ message: 'El título de la conferencia debe ser texto' })
  @MaxLength(100, { message: 'El título de la conferencia es demasiado largo' })
  titulo_conferencia?: string;

  @ApiProperty({ example: 'Descripción de conferencia...', description: 'Descripción de la conferencia', required: false })
  @IsOptional()
  @IsString({ message: 'La descripción de la conferencia debe ser texto' })
  @MaxLength(180, { message: 'La descripción de la conferencia es demasiado larga' })
  descripcion_conferencia?: string;

  @ApiProperty({ example: 'Título del taller', description: 'Título del taller', required: false })
  @IsOptional()
  @IsString({ message: 'El título del taller debe ser texto' })
  @MaxLength(50, { message: 'El título del taller es demasiado largo' })
  titulo_taller?: string;

  @ApiProperty({ example: 'Descripción del taller...', description: 'Descripción del taller', required: false })
  @IsOptional()
  @IsString({ message: 'La descripción del taller debe ser texto' })
  @MaxLength(180, { message: 'La descripción del taller es demasiado larga' })
  descripcion_taller?: string;

  // ===================================
  // REDES SOCIALES (OPCIONALES PARA PONENTES)
  // ===================================

  @ApiProperty({ example: 'https://facebook.com/usuario', description: 'URL de Facebook', required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString({ message: 'La URL de Facebook debe ser texto' })
  facebook_link?: string;

  @ApiProperty({ example: 'https://instagram.com/usuario', description: 'URL de Instagram', required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString({ message: 'La URL de Instagram debe ser texto' })
  instagram_link?: string;

  @ApiProperty({ example: 'https://x.com/usuario', description: 'URL de X/Twitter', required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString({ message: 'La URL de X debe ser texto' })
  x_link?: string;

  @ApiProperty({ example: 'https://linkedin.com/in/usuario', description: 'URL de LinkedIn', required: false })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString({ message: 'La URL de LinkedIn debe ser texto' })
  linkedin_link?: string;
}

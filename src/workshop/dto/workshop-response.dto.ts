// src/workshop/dto/workshop-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsOptional, IsDate, IsEnum,
  IsBoolean, IsArray, IsIn
} from 'class-validator';
import { status_enum } from '@prisma/client';

export class WorkshopResponseDto {
  @ApiProperty({ example: 1, description: 'ID del taller' })
  @IsNumber()
  workshop_id: number;

  @ApiProperty({ example: 'Taller de Programación Avanzada' })
  @IsString()
  @IsOptional()
  name_workshop?: string;

  @ApiProperty({ example: 'Descripción del taller' })
  @IsString()
  @IsOptional()
  descript?: string;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @IsOptional()
  spots_max?: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @IsOptional()
  spots_occupied?: number;

  @ApiProperty({ example: 15, description: 'Cupos disponibles' })
  @IsNumber()
  @IsOptional()
  available_spots?: number;

  @ApiProperty({ example: 'Edificio K' })
  @IsString()
  @IsOptional()
  building?: string;

  @ApiProperty({ example: 'Laboratorio K1' })
  @IsString()
  @IsOptional()
  classroom?: string;

  @ApiProperty({ example: 'active', enum: status_enum })
  @IsEnum(status_enum)
  @IsOptional()
  status?: status_enum;

  @ApiProperty({ example: 123 })
  @IsNumber()
  @IsOptional()
  instructor_user_id?: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @IsDate()
  @IsOptional()
  created_at?: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @IsDate()
  @IsOptional()
  updated_at?: Date;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsOptional()
  instructor_name?: string;

  // NUEVOS CAMPOS
  @ApiProperty({ example: 'Intermedio', enum: ['Principiante','Intermedio','Avanzado'] })
  @IsString()
  @IsIn(['Principiante','Intermedio','Avanzado'])
  @IsOptional()
  level?: string;

  @ApiProperty({ example: 'Ciberseguridad' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: ['Docker','RabbitMQ','Selenium'] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tools?: string[];

  // Estado del usuario
  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  is_user_enrolled?: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  can_enroll?: boolean;

  @ApiProperty({
    example: 'can_enroll',
    enum: ['not_authenticated','needs_payment','can_enroll','already_enrolled','no_spots']
  })
  @IsString()
  @IsOptional()
  enrollment_status?: string;

  @ApiProperty({ example: 'Inscribirse' })
  @IsString()
  @IsOptional()
  button_text?: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  button_disabled?: boolean;

  @ApiProperty({ example: 'default', enum: ['default','warning','success','danger'] })
  @IsString()
  @IsOptional()
  button_type?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer'; 
import { IsString, IsNotEmpty, Length, IsNumber, Min, Max, IsDate, Matches} from 'class-validator';

export class CreateWorkshopDto {
  @ApiProperty({
    description: 'Descripción del taller',
    example: 'Un taller sobre como la IA está cambiando el mundo',
    minLength: 10,
    maxLength: 100,
  })
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @Length(10, 100, { message: 'La descripción debe tener entre 10 y 100 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description: string;

  @ApiProperty({
    description: 'Nombre del ponente',
    example: 'Juan',
    minLength: 3,
    maxLength: 30,
  })
  @IsString({ message: 'El nombre del ponente debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del ponente es obligatorio' })
  @Length(3, 30, { message: 'El nombre del ponente debe tener entre 3 y 30 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  speakerName: string;

  @ApiProperty({
    description: 'Apellido paterno del ponente',
    example: 'Perez',
    minLength: 3,
    maxLength: 50,
  })
  @IsString({ message: 'El apellido paterno debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El apellido paterno es obligatorio' })
  @Length(3, 50, { message: 'El apellido paterno debe tener entre 3 y 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  speakerPaternalSurname: string;

  @ApiProperty({
    description: 'Apellido materno del ponente',
    example: 'Gomez',
    minLength: 3,
    maxLength: 50,
  })
  @IsString({ message: 'El apellido materno debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El apellido materno es obligatorio' })
  @Length(3, 50, { message: 'El apellido materno debe tener entre 3 y 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  speakerMaternalSurname: string;

  @ApiProperty({
    description: 'Nombre del taller',
    example: 'La Inteligencia Artificial en la Vida Cotidiana',
    minLength: 3,
    maxLength: 50,
    required: false,
  })
  @IsString({ message: 'El nombre del taller debe ser una cadena de texto' })
  @Length(3, 50, { message: 'El nombre del taller debe tener entre 3 y 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Transform(({ value }) => (value === '' ? undefined : value))
  name?: string;

  @ApiProperty({
    description: 'Capacidad máxima de asistentes',
    minimum: 1,
    maximum: 20,
  })
  @IsNumber({}, { message: 'La capacidad debe ser un número' })
  @Min(1, { message: 'La capacidad debe ser al menos 1' })
  @Max(20, { message: 'La capacidad no puede ser mayor de 20' })
  @IsNotEmpty({ message: 'La capacidad es obligatoria' })
  capacity: number;

  @ApiProperty({
    description: 'Ubicación del taller (edificio y salón)',
    example: 'Edificio K, Salón K10',
    minLength: 5,
    maxLength: 50,
  })
  @IsString({ message: 'La ubicación debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La ubicación es obligatoria' })
  @Length(5, 50, { message: 'La ubicación debe tener entre 5 y 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location: string;

  @ApiProperty({
    description: 'Fecha del taller en formato ISO (YYYY-MM-DD)',
    example: '2025-11-15',
  })
  @Type(() => Date)
  @IsDate({ message: 'La fecha debe ser una fecha válida' })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  date: Date;

  @ApiProperty({
    description: 'Hora de inicio del taller en formato HH:mm (24 horas)',
    example: '14:30',
  })
  @IsString({ message: 'La hora de inicio debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de inicio debe tener el formato HH:mm (24 horas)',
  })
  startTime: string;

  @ApiProperty({
    description: 'Hora de fin del taller en formato HH:mm (24 horas)',
    example: '16:00',
  })
  @IsString({ message: 'La hora de fin debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La hora de fin es obligatoria' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de fin debe tener el formato HH:mm (24 horas)',
  })
  endTime: string;
}
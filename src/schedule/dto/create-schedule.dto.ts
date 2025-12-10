import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer'; 
import { IsString, IsNotEmpty, Length, IsDate, Matches} from 'class-validator';

export class CreateScheduleDto {

//name of the event
  @ApiProperty({
    description: 'Nombre del evento',
    example: 'Conferencia de Tecnología',
    minLength: 3,
    maxLength: 50,
  })
  @IsString({ message: 'El nombre del evento debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del evento es obligatorio' })
  @Length(3, 50, { message: 'El nombre del evento debe tener entre 3 y 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) // eliminate spaces xd
  eventName: string;

// description of the event (conference)
  @ApiProperty({
    description: 'Descripción del evento',
    example: 'Una conferencia sobre como la IA está cambiando el mundo',
    minLength: 10,
    maxLength: 100,
  })
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @Length(10, 100, { message: 'La descripción debe tener entre 10 y 100 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  descriptionEvent: string;

// date of the event
  @ApiProperty({
    description: 'Fecha del evento en formato ISO (YYYY-MM-DD)',
    example: '2025-11-15',
    
  })
  @Type(() => Date)
  @IsDate({ message: 'La fecha debe ser una fecha válida (formato YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'La fecha es obligatoria' })
  date: Date;

// start time of the event
  @ApiProperty({
    description: 'Hora de inicio del evento en formato HH:mm (24 horas)',
    example: '14:30',
    
  })
  @IsString({ message: 'La hora de inicio debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de inicio debe tener el formato HH:mm (24 horas)',
  })
  startTime: string;

// end time of the event
  @ApiProperty({
    description: 'Hora de fin del evento en formato HH:mm (24 horas)',
    example: '16:00',

  })
  @IsString({ message: 'La hora de fin debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La hora de fin es obligatoria' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de fin debe tener el formato HH:mm (24 horas)',
  })
  endTime: string;

// name of the speaker for conferences
  @ApiProperty({
    description: 'Nombre del ponente',
    example: 'Juan',
    minLength: 3,
    maxLength: 30,
  })
  @IsString({ message: 'El nombre del ponente debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del ponente es obligatorio' })
  @Length(3, 30, { message: 'El nombre del ponente debe tener entre 3 y 30  caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  speakerName: string;

  // paternal surname of the speaker for conferences
  @ApiProperty({
    description: 'Apellido paterno del ponente',
    example: 'Perez',
    minLength: 3,
    maxLength: 50,
  })
  @IsString({ message: 'El apellido paterno del ponente debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El apellido paterno del ponente es obligatorio' })
  @Length(3, 50, { message: 'El apellido paterno del ponente debe tener entre 3 y 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  speakerPaternalSurname: string;

    // maternal surname of the speaker for conferences
  @ApiProperty({
    description: 'Apellido materno del ponente',
    example: 'Gomez',
    minLength: 3,
    maxLength: 50,
  })
  @IsString({ message: 'El apellido materno del ponente debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El apellido materno del ponente es obligatorio' })
  @Length(3, 50, { message: 'El apellido materno del ponente debe tener entre 3 y 50 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  speakerMaternalSurname: string;

}





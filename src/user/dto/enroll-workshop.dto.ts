import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EnrollWorkshopDto {
  @ApiProperty({ example: 3, description: 'ID del taller a inscribirse' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  workshopId!: number;
}

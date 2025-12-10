// src/game/scores/dto/create-score.dto.ts
import { IsNumber, IsPositive } from 'class-validator';

export class CreateScoreDto {
  @IsNumber()
  @IsPositive()
  value: number;
}
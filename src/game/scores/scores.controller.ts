import { Controller, Post, Body, Get, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ScoresService } from './scores.service';
import { CreateScoreDto } from './dto/create-score.dto';
import { JwtAuthGuard } from '@/auth/validation/guards/jwt.guard';

@Controller('scores')
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  // Crear un puntaje
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req, @Body() dto: CreateScoreDto) {
    try {
      
      // El payload del token JWT tiene { userId, email } según tu estrategia JWT
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new HttpException('Usuario no autenticado', HttpStatus.UNAUTHORIZED);
      }

      // Convertir a BigInt
      const userBigIntId = BigInt(userId);

      // Llamar al servicio para crear el puntaje
      return await this.scoresService.createScore(userBigIntId, dto);
    } catch (error) {
      throw new HttpException(
        `Error al guardar puntaje: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // Obtener el leaderboard
  @Get('leaderboard')
  async getLeaderboard() {
    try {
      // Llamar al servicio para obtener el leaderboard
      return await this.scoresService.getLeaderboard();
    } catch (error) {
      // Manejo de errores
      throw new HttpException(
        `Error al obtener leaderboard: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Obtener el mejor puntaje del usuario autenticado
  @UseGuards(JwtAuthGuard)
  @Get('my-best')
  async getMyBestScore(@Req() req) {
    try {
      // Obtener userId desde el token JWT
      const userId = BigInt(req.user.userId);

      // Llamar al servicio para obtener el mejor puntaje del usuario
      return await this.scoresService.getUserBestScore(userId);
    } catch (error) {
      // Manejo de errores
      throw new HttpException(
        `Error al obtener mejor puntaje: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Obtener todos los puntajes del usuario autenticado
  @UseGuards(JwtAuthGuard)
  @Get('my-scores')
  async getMyScores(@Req() req) {
    try {
      // Obtener userId desde el token JWT
      const userId = BigInt(req.user.userId);

      // Llamar al servicio para obtener todos los puntajes del usuario
      return await this.scoresService.getUserScores(userId);
    } catch (error) {
      // Manejo de errores
      throw new HttpException(
        `Error al obtener puntajes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

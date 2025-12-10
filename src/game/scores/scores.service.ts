// src/game/scores/scores.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateScoreDto } from './dto/create-score.dto';

@Injectable()
export class ScoresService {
  constructor(private prisma: PrismaService) {}

  async createScore(userId: bigint, dto: CreateScoreDto) {
    try {

      if (!userId || isNaN(Number(userId))) {
        throw new Error('User ID inválido o ausente');
      }

      const userBigIntId = BigInt(userId);

      // 1. Busca el mejor puntaje actual del usuario.
      const userBestScore = await this.prisma.game_score.findFirst({
        where: { user_id: userBigIntId },
        orderBy: { score: 'desc' },
      });

      // 2. Compara el nuevo puntaje con el mejor actual.
      if (!userBestScore || dto.value > userBestScore.score) {
        // 3. Si ya existe un puntaje, actualízalo.
        if (userBestScore) {
          const updatedScore = await this.prisma.game_score.update({
            where: { game_score_id: userBestScore.game_score_id },
            data: { 
              score: dto.value,
            },
          });

          return {
            message: "¡Nuevo récord personal!",
            game_score_id: updatedScore.game_score_id.toString(),
            score: updatedScore.score,
            user_id: updatedScore.user_id ? updatedScore.user_id.toString() : null,
            created_at: updatedScore.created_at,
          };
        } else {
          // 4. Si es el primer puntaje del usuario, créalo con ID automático
          const newScore = await this.prisma.game_score.create({
            data: {
              score: dto.value,
              user_id: userBigIntId,
            },
          });

          return {
            message: "¡Primer puntaje guardado!",
            game_score_id: newScore.game_score_id.toString(),
            score: newScore.score,
            user_id: newScore.user_id ? newScore.user_id.toString() : null,
            created_at: newScore.created_at,
          };
        }
      }
      
      // Si el nuevo puntaje no es un récord, devuelve mensaje informativo
      return {
        message: "El puntaje no supera tu mejor marca actual",
        current_best: {
          game_score_id: userBestScore.game_score_id.toString(),
          score: userBestScore.score,
          user_id: userBestScore.user_id ? userBestScore.user_id.toString() : null,
          created_at: userBestScore.created_at,
        },
        new_score: dto.value
      };
    } catch (error) {
      throw new Error(`Error al guardar puntaje: ${error.message}`);
    }
  }

  async getLeaderboard() {
    try {
      const leaderboard = await this.prisma.game_score.findMany({
        orderBy: { score: 'desc' },
        take: 10,
        include: { 
          users: { 
            select: { 
              user_id: true, 
              name_user: true, 
              email: true 
            } 
          } 
        },
      });

      // ✅ CORREGIDO: Mapear correctamente y evitar conflicto de nombres
      return leaderboard.map(item => ({
        id: item.game_score_id.toString(),
        value: item.score,
        email: item.users?.email || null,
        name_user: item.users?.name_user || null, // ← No más 'Jugador' por defecto
        user_id: item.user_id ? item.user_id.toString() : null,
        created_at: item.created_at,
      }));
    } catch (error) {
      throw new Error(`Error al obtener leaderboard: ${error.message}`);
    }
  }

  async getUserBestScore(userId: bigint) {
    try {
      const scores = await this.prisma.game_score.findMany({
        where: { user_id: userId },
        orderBy: { score: 'desc' },
        take: 1,
      });
      
      if (scores[0]) {
        return {
          game_score_id: scores[0].game_score_id.toString(),
          score: scores[0].score,
          user_id: scores[0].user_id ? scores[0].user_id.toString() : null,
          created_at: scores[0].created_at,
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Error al obtener mejor puntaje: ${error.message}`);
    }
  }

  // Método adicional para obtener todos los puntajes de un usuario
  async getUserScores(userId: bigint) {
    try {
      const scores = await this.prisma.game_score.findMany({
        where: { user_id: userId },
        orderBy: { score: 'desc' },
      });

      return scores.map(score => ({
        game_score_id: score.game_score_id.toString(),
        score: score.score,
        user_id: score.user_id ? score.user_id.toString() : null,
        created_at: score.created_at,
      }));
    } catch (error) {
      throw new Error(`Error al obtener puntajes del usuario: ${error.message}`);
    }
  }
}
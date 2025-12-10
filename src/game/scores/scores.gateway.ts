import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { ScoresService } from './scores.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/validation/guards/jwt.guard';

@WebSocketGateway({ namespace: 'scores' })
export class ScoresGateway {
  constructor(private scoresService: ScoresService) {}

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('submitScore')
  async handleSubmitScore(@MessageBody() dto: { value: number; game_score_id: bigint }, @ConnectedSocket() client: any) {
    const userId = client.user.id;
    const newScore = await this.scoresService.createScore(userId, dto);
    client.broadcast.emit('newLeaderboard', await this.scoresService.getLeaderboard());
    return newScore;
  }

  @SubscribeMessage('getLeaderboard')
  async handleGetLeaderboard(@ConnectedSocket() client: any) {
    client.emit('leaderboard', await this.scoresService.getLeaderboard());
  }
}
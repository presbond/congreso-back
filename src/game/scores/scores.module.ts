import { Module } from '@nestjs/common';
import { ScoresService } from './scores.service';
import { ScoresGateway } from './scores.gateway';
import { ScoresController } from './scores.controller';
import { PrismaService } from '../../../prisma/prisma.service';

@Module({
  imports: [],
  controllers: [ScoresController],
  providers: [ScoresService, ScoresGateway, PrismaService],
  exports: [ScoresService],
})
export class ScoresModule {}

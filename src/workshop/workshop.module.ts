// src/workshop/workshop.module.ts
import { Module } from '@nestjs/common';
import { WorkshopService } from './workshop.service';
import { WorkshopController } from './workshop.controller';
import { PrismaService } from '@prisma/prisma.service';

@Module({
  controllers: [WorkshopController],
  providers: [WorkshopService, PrismaService],
  exports: [WorkshopService],
})
export class WorkshopModule {}
// src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  controllers: [AdminController, FinanceController, AttendanceController],
  providers: [AdminService, FinanceService, AttendanceService, PrismaService],
  exports: [AdminService, FinanceService, AttendanceService],
})
export class AdminModule {}

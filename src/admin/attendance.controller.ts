// src/admin/attendance.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/validation/guards/jwt.guard';
import { AttendanceService } from './attendance.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ============================================================
  // 📌 Escanear QR y registrar asistencia
  // POST /admin/attendance/scan-qr
  // ============================================================
  @Post('scan-qr')
  async scanQr(@Body() dto: ScanQrDto) {
    return this.attendanceService.scanQr(dto);
  }

  // ============================================================
  // 📌 Listar talleres/eventos para el selector
  // GET /admin/attendance/workshops
  // ============================================================
  @Get('workshops')
  async listWorkshops() {
    return this.attendanceService.listWorkshopsForAttendance();
  }

  // ============================================================
  // 📌 Listas de usuarios de un taller, agrupados por tipo
  // GET /admin/attendance/workshops/:id/users-by-type
  // ============================================================
  @Get('workshops/:id/users-by-type')
  async listUsersByType(@Param('id', ParseIntPipe) id: number) {
    return this.attendanceService.listWorkshopUsersByType(id);
  }
}

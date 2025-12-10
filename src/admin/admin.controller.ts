import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Delete,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Post,
  Res,
} from '@nestjs/common';

import { Response } from 'express';
import { JwtAuthGuard } from '@/auth/validation/guards/jwt.guard';

import { AdminService } from './admin.service';
import { GenerateBadgesDto } from './dto/generate-badges.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================================
  // 📌 Eliminar usuarios
  // ============================================================
  @Delete(':id')
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id);
  }

  // ============================================================
  // 📌 SEND CERTIFICATES BY EMAIL (MASIVO)
  // ============================================================
  @Post('send-certificates')
  async sendCertificates(
    @Body() body: any, // intencional: evitar problemas con ValidationPipe
  ) {
    const rawIds = body?.ids;

    const ids = Array.isArray(rawIds)
      ? rawIds
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v) && v > 0)
      : [];

    // Nunca lanzamos BadRequest aquí; el servicio regresa un resumen
    return this.adminService.sendCertificates(ids);
  }

  // ============================================================
  // 📌 FILTER OPTIONS
  // ============================================================
  @Get('filter-options')
  async getFilterOptions() {
    return this.adminService.getFilterOptions();
  }

  // ============================================================
  // 📌 LIST USERS
  // ============================================================
  @Get()
  async listUsers(
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('grade') grade?: string,
    @Query('group') group?: string,
    @Query('page', new DefaultValuePipe(1)) page = 1,
    @Query('pageSize', new DefaultValuePipe(20)) pageSize = 20,
  ) {
    if (page < 1) throw new BadRequestException('page debe ser mayor a 0');
    if (pageSize < 1 || pageSize > 200) {
      throw new BadRequestException('pageSize debe estar entre 1 y 200');
    }

    return this.adminService.listUsers({
      q,
      filter,
      grade,
      group,
      page,
      pageSize,
    });
  }

  // ============================================================
  // 📌 UPDATE ACTIVATION FOR ONE USER
  // ============================================================
  @Patch(':id/activation')
  async setActivation(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      activate: boolean;
      force?: boolean;
      reason?: string;
      status_event?: boolean;
    },
  ) {
    return this.adminService.setUserEventActivation({
      userId: id,
      activate: body.activate,
      force: body.force ?? false,
      reason: body.reason,
      status_event: body.status_event ?? body.activate,
    });
  }

  // ============================================================
  // 📌 BULK ACTIVATION
  // ============================================================
  @Patch('activation-bulk')
  async bulkActivation(
    @Body()
    body: {
      ids: number[];
      activate: boolean;
      force?: boolean;
      status_event?: boolean;
    },
  ) {
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('Debes enviar al menos un ID');
    }

    return this.adminService.setUsersEventActivationBulk({
      ids: body.ids,
      activate: body.activate,
      force: body.force ?? false,
      status_event: body.status_event ?? body.activate,
    });
  }

  // ============================================================
  // ============================================================
  // 📌 GENERATE BADGES PDF (MASIVO)
  // ============================================================
  @Post('generate-badges')
  async generateBadges(
    @Body() body: any,     // 👈 IMPORTANTE: usar any para saltarse el ValidationPipe global
    @Res() res: Response,
  ) {
    let rawIds = body?.ids;

    // Asegurarnos siempre de tener un array
    if (!Array.isArray(rawIds)) {
      rawIds = [];
    }

    // Normalizar y limpiar: convertir a número, quitar basura
    const ids = rawIds
      .map((v) => Number(String(v ?? '').trim()))
      .filter((v) => Number.isFinite(v) && v > 0);

    console.log('📩 rawIds (body.ids):', rawIds);
    console.log('📌 ids procesados (números válidos):', ids);

    if (!ids.length) {
      throw new BadRequestException('Debes enviar al menos un ID numérico válido.');
    }

    let markPrinted = true;
    if (typeof body?.markPrinted === 'boolean') {
      markPrinted = body.markPrinted;
    } else if (typeof (body as any)?.markPrinted === 'string') {
      markPrinted = (body as any).markPrinted !== 'false';
    }

    const pdfBuffer = await this.adminService.generateBadgesPdf(
      ids,
      markPrinted,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="gafetes.pdf"',
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    return res.send(pdfBuffer);
  }


}

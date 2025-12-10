// finance.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

type ListMovementsArgs = {
  tipo?: 'INGRESO' | 'GASTO' | 'ALL';
  categoriaId?: number;
};

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // 📌 RESUMEN GENERAL DE FINANZAS
  // ============================================================
  async getSummary(price: number) {
    if (Number.isNaN(price) || price <= 0) {
      throw new BadRequestException(
        'El precio del evento debe ser mayor a 0.',
      );
    }

    const paidUsersCount = await this.prisma.users.count({
      where: { status_event: true },
    });

    const [ingresosAgg, gastosAgg] = await this.prisma.$transaction([
      this.prisma.movimientos_financieros.aggregate({
        _sum: { monto: true },
        where: { tipo: 'INGRESO' },
      }),
      this.prisma.movimientos_financieros.aggregate({
        _sum: { monto: true },
        where: { tipo: 'GASTO' },
      }),
    ]);

    const totalIngresosDb =
      (ingresosAgg._sum.monto as Prisma.Decimal | null)?.toNumber() ?? 0;
    const totalGastosDb =
      (gastosAgg._sum.monto as Prisma.Decimal | null)?.toNumber() ?? 0;

    const ticketsRevenue = paidUsersCount * price;
    const balance = ticketsRevenue + totalIngresosDb - totalGastosDb;

    return {
      paidUsersCount,
      ticketPrice: price,
      ticketsRevenue,
      totalIngresosDb,
      totalGastosDb,
      balance,
    };
  }

  // ============================================================
  // 📌 LISTAR CATEGORÍAS
  // ============================================================
  async listCategories() {
    const categories = await this.prisma.categoria_movimiento.findMany({
      orderBy: { nombre: 'asc' },
    });

    return categories.map((c) => ({
      id: Number(c.id_categoria),
      nombre: c.nombre,
      descripcion: c.descripcion,
    }));
  }

  // ============================================================
  // 📌 CREAR CATEGORÍA
  // ============================================================
  async createCategory(dto: { nombre: string; descripcion?: string }) {
    if (!dto.nombre?.trim()) {
      throw new BadRequestException(
        'El nombre de la categoría es obligatorio.',
      );
    }

    const created = await this.prisma.categoria_movimiento.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
      },
    });

    return {
      id: Number(created.id_categoria),
      nombre: created.nombre,
      descripcion: created.descripcion,
    };
  }

  // ============================================================
  // ✏️ ACTUALIZAR CATEGORÍA
  // ============================================================
  async updateCategory(
    id: number,
    dto: { nombre: string; descripcion?: string },
  ) {
    if (!dto.nombre?.trim()) {
      throw new BadRequestException(
        'El nombre de la categoría es obligatorio.',
      );
    }

    const exists = await this.prisma.categoria_movimiento.findUnique({
      where: { id_categoria: BigInt(id) },
    });

    if (!exists) {
      throw new NotFoundException('La categoría no existe.');
    }

    const updated = await this.prisma.categoria_movimiento.update({
      where: { id_categoria: BigInt(id) },
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
      },
    });

    return {
      id: Number(updated.id_categoria),
      nombre: updated.nombre,
      descripcion: updated.descripcion,
    };
  }

  // ============================================================
  // 🗑️ ELIMINAR CATEGORÍA (solo si no tiene movimientos)
  // ============================================================
  async deleteCategory(id: number) {
    const exists = await this.prisma.categoria_movimiento.findUnique({
      where: { id_categoria: BigInt(id) },
    });

    if (!exists) {
      throw new NotFoundException('La categoría no existe.');
    }

    const count = await this.prisma.movimientos_financieros.count({
      where: { id_categoria: BigInt(id) },
    });

    if (count > 0) {
      throw new BadRequestException(
        `No se puede eliminar la categoría porque tiene ${count} movimientos asociados.`,
      );
    }

    await this.prisma.categoria_movimiento.delete({
      where: { id_categoria: BigInt(id) },
    });

    return { success: true, message: 'Categoría eliminada correctamente.' };
  }

  // ============================================================
  // 📌 LISTAR MOVIMIENTOS
  // ============================================================
  async listMovements({ tipo, categoriaId }: ListMovementsArgs) {
    const where: Prisma.movimientos_financierosWhereInput = {};

    if (tipo && tipo !== 'ALL') {
      where.tipo = tipo;
    }

    if (categoriaId) {
      where.id_categoria = BigInt(categoriaId);
    }

    const movimientos = await this.prisma.movimientos_financieros.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        categoria_movimiento: true,
        users: {
          select: {
            user_id: true,
            name_user: true,
            paternal_surname: true,
            maternal_surname: true,
            email: true,
          },
        },
      },
    });

    return movimientos.map((m) => ({
      id: Number(m.id_movimiento),
      tipo: m.tipo as 'INGRESO' | 'GASTO',
      fecha: m.fecha,
      monto: (m.monto as Prisma.Decimal).toNumber(),
      descripcion: m.descripcion,
      medio_pago: m.medio_pago,
      id_categoria: m.id_categoria ? Number(m.id_categoria) : 0,
      categoria: m.categoria_movimiento
        ? {
            id: Number(m.categoria_movimiento.id_categoria),
            nombre: m.categoria_movimiento.nombre,
          }
        : null,
      usuario: m.users
        ? {
            id: Number(m.users.user_id),
            nombre: [
              m.users.name_user,
              m.users.paternal_surname,
              m.users.maternal_surname,
            ]
              .filter(Boolean)
              .join(' '),
            email: m.users.email,
          }
        : null,
    }));
  }

  // ============================================================
  // 📌 CREAR MOVIMIENTO
  // ============================================================
  async createMovement(dto: {
    tipo: 'INGRESO' | 'GASTO';
    monto: number;
    descripcion?: string;
    medio_pago: 'EFECTIVO' | 'TARJETA';
    id_categoria: number;
    id_usuario?: number | null;
  }) {
    if (!['INGRESO', 'GASTO'].includes(dto.tipo)) {
      throw new BadRequestException('tipo debe ser INGRESO o GASTO.');
    }
    if (dto.monto == null || dto.monto < 0) {
      throw new BadRequestException('monto debe ser mayor o igual a 0.');
    }
    if (!['EFECTIVO', 'TARJETA'].includes(dto.medio_pago)) {
      throw new BadRequestException('medio_pago debe ser EFECTIVO o TARJETA.');
    }
    if (!dto.id_categoria) {
      throw new BadRequestException('id_categoria es obligatorio.');
    }

    const created = await this.prisma.movimientos_financieros.create({
      data: {
        tipo: dto.tipo,
        monto: new Prisma.Decimal(dto.monto),
        descripcion: dto.descripcion?.trim() || null,
        medio_pago: dto.medio_pago,
        id_categoria: BigInt(dto.id_categoria),
        id_usuario: dto.id_usuario ? BigInt(dto.id_usuario) : null,
      },
      include: {
        categoria_movimiento: true,
        users: {
          select: {
            user_id: true,
            name_user: true,
            paternal_surname: true,
            maternal_surname: true,
            email: true,
          },
        },
      },
    });

    return {
      id: Number(created.id_movimiento),
      tipo: created.tipo as 'INGRESO' | 'GASTO',
      fecha: created.fecha,
      monto: (created.monto as Prisma.Decimal).toNumber(),
      descripcion: created.descripcion,
      medio_pago: created.medio_pago,
      id_categoria: created.id_categoria
        ? Number(created.id_categoria)
        : dto.id_categoria,
      categoria: created.categoria_movimiento
        ? {
            id: Number(created.categoria_movimiento.id_categoria),
            nombre: created.categoria_movimiento.nombre,
          }
        : null,
      usuario: created.users
        ? {
            id: Number(created.users.user_id),
            nombre: [
              created.users.name_user,
              created.users.paternal_surname,
              created.users.maternal_surname,
            ]
              .filter(Boolean)
              .join(' '),
            email: created.users.email,
          }
        : null,
    };
  }

  // ============================================================
  // 📌 ACTUALIZAR MOVIMIENTO
  // ============================================================
  async updateMovement(
    id: number,
    dto: {
      tipo: 'INGRESO' | 'GASTO';
      monto: number;
      descripcion?: string;
      medio_pago: 'EFECTIVO' | 'TARJETA';
      id_categoria: number;
      id_usuario?: number | null;
    },
  ) {
    const exists = await this.prisma.movimientos_financieros.findUnique({
      where: { id_movimiento: BigInt(id) },
    });

    if (!exists) {
      throw new NotFoundException('El movimiento no existe.');
    }

    const updated = await this.prisma.movimientos_financieros.update({
      where: { id_movimiento: BigInt(id) },
      data: {
        tipo: dto.tipo,
        monto: new Prisma.Decimal(dto.monto),
        descripcion: dto.descripcion?.trim() || null,
        medio_pago: dto.medio_pago,
        id_categoria: BigInt(dto.id_categoria),
        id_usuario: dto.id_usuario ? BigInt(dto.id_usuario) : null,
      },
      include: {
        categoria_movimiento: true,
        users: {
          select: {
            user_id: true,
            name_user: true,
            paternal_surname: true,
            maternal_surname: true,
            email: true,
          },
        },
      },
    });

    return {
      id: Number(updated.id_movimiento),
      tipo: updated.tipo as 'INGRESO' | 'GASTO',
      fecha: updated.fecha,
      monto: (updated.monto as Prisma.Decimal).toNumber(),
      descripcion: updated.descripcion,
      medio_pago: updated.medio_pago,
      id_categoria: updated.id_categoria
        ? Number(updated.id_categoria)
        : dto.id_categoria,
      categoria: updated.categoria_movimiento
        ? {
            id: Number(updated.categoria_movimiento.id_categoria),
            nombre: updated.categoria_movimiento.nombre,
          }
        : null,
      usuario: updated.users
        ? {
            id: Number(updated.users.user_id),
            nombre: [
              updated.users.name_user,
              updated.users.paternal_surname,
              updated.users.maternal_surname,
            ]
              .filter(Boolean)
              .join(' '),
            email: updated.users.email,
          }
        : null,
    };
  }

  // ============================================================
  // 📌 ELIMINAR MOVIMIENTO
  // ============================================================
  async deleteMovement(id: number) {
    const exists = await this.prisma.movimientos_financieros.findUnique({
      where: { id_movimiento: BigInt(id) },
    });

    if (!exists) {
      throw new NotFoundException('El movimiento no existe.');
    }

    await this.prisma.movimientos_financieros.delete({
      where: { id_movimiento: BigInt(id) },
    });

    return { success: true, message: 'Movimiento eliminado correctamente.' };
  }

  // Helper que ya te sugerí antes (por si aún no lo agregas)
  private formatMoney(value: number): string {
    return value.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // ============================================================
  // 📄 GENERAR PDF DE ANÁLISIS GENERAL MEJORADO
  // ============================================================
  async exportGeneralAnalysisPdf(price: number): Promise<Buffer> {
    try {
      // 1) Resumen general (boletos + ingresos extra + gastos)
      const summary = await this.getSummary(price);

      // 2) Todos los movimientos para análisis detallado
      const movimientos = await this.listMovements({ tipo: 'ALL' });
      const ingresos = movimientos.filter((m) => m.tipo === 'INGRESO');
      const gastos = movimientos.filter((m) => m.tipo === 'GASTO');

      const totalIngresosMov = ingresos.reduce((acc, m) => acc + m.monto, 0);
      const totalGastosMov = gastos.reduce((acc, m) => acc + m.monto, 0);

      // 3) Resumen por categoría
      const categoriasMap = new Map<
        string,
        { ingresos: number; gastos: number; balance: number }
      >();

      for (const m of movimientos) {
        const nombreCat = m.categoria?.nombre || 'Sin categoría';
        if (!categoriasMap.has(nombreCat)) {
          categoriasMap.set(nombreCat, { ingresos: 0, gastos: 0, balance: 0 });
        }
        const entry = categoriasMap.get(nombreCat)!;
        if (m.tipo === 'INGRESO') entry.ingresos += m.monto;
        if (m.tipo === 'GASTO') entry.gastos += m.monto;
        entry.balance = entry.ingresos - entry.gastos;
      }

      const categoriasResumen = Array.from(categoriasMap.entries()).map(
        ([nombre, data]) => ({
          nombre,
          ...data,
        }),
      );

      // Totales globales
      const totalIngresosTotales =
        summary.ticketsRevenue + summary.totalIngresosDb;
      const totalGastosTotales = summary.totalGastosDb;

      const balance = summary.balance;
      const balanceEsNegativo = balance < 0;
      const balanceAbs = Math.abs(balance);
      const resultadoTexto = balanceEsNegativo ? 'PÉRDIDA' : 'GANANCIA';
      const resultadoColor = balanceEsNegativo ? '#B71C1C' : '#1B5E20';

      return await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'LETTER',
          margin: 40,
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: Error) => reject(err));

        // ======================================================
        // 📄 PÁGINA 1: RESUMEN EJECUTIVO VISUAL
        // ======================================================
        try {
          const bgPath = join(
            process.cwd(),
            'public',
            'finance',
            'report-bg.png',
          );
          doc.image(bgPath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
          });
        } catch {
          // fondo opcional
        }

        const pageWidth = doc.page.width;
        const marginX = 40;
        const headerY = 80; // ⬅️ un poco más abajo para no tapar el fondo

        doc
          .font('Helvetica-Bold')
          .fontSize(20)
          .fillColor('#111827')
          .text('Análisis financiero general - 3er Congreso', marginX, headerY, {
            align: 'left',
          });

        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#4B5563')
          .text(
            `Fecha de generación: ${new Date().toLocaleString('es-MX')}`,
            marginX,
            headerY + 25,
          );

        // ---- Cards estilo dashboard --------------------------------
        const cardWidth = (pageWidth - marginX * 2 - 20) / 2; // 2 por fila
        const cardHeight = 80;
        const gap = 20;
        let cardsY = headerY + 70;

        const drawCard = (
          x: number,
          y: number,
          title: string,
          value: string,
          subtitle: string,
          bgColor = '#FFFFFF',
        ) => {
          doc.save();

          doc
            .roundedRect(x, y, cardWidth, cardHeight, 10)
            .fillOpacity(0.95)
            .fill(bgColor);

          doc.fillOpacity(1);

          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#6B7280')
            .text(title, x + 14, y + 10);

          doc
            .font('Helvetica-Bold')
            .fontSize(16)
            .fillColor('#111827')
            .text(value, x + 14, y + 28);

          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#4B5563')
            .text(subtitle, x + 14, y + 52);

          doc.restore();
        };

        const xLeft = marginX;
        const xRight = marginX + cardWidth + gap;

        // fila 1
        drawCard(
          xLeft,
          cardsY,
          'Usuarios pagados',
          String(summary.paidUsersCount),
          'Personas con acceso al evento',
          '#F3E8FF', // morado suave
        );

        drawCard(
          xRight,
          cardsY,
          'Precio por boleto',
          `$ ${this.formatMoney(summary.ticketPrice)}`,
          'Valor unitario del boleto',
          '#DBEAFE', // azul suave
        );

        cardsY += cardHeight + gap;

        // fila 2
        drawCard(
          xLeft,
          cardsY,
          'Ingresos por boletos',
          `$ ${this.formatMoney(summary.ticketsRevenue)}`,
          `${summary.paidUsersCount} × $${this.formatMoney(
            summary.ticketPrice,
          )}`,
          '#DCFCE7', // verde suave
        );

        drawCard(
          xRight,
          cardsY,
          'Ingresos adicionales',
          `$ ${this.formatMoney(summary.totalIngresosDb)}`,
          'Patrocinios, ventas, etc. mas registros',
          '#E0F2FE', // azul muy claro
        );

        cardsY += cardHeight + gap;

        // fila 3
        drawCard(
          xLeft,
          cardsY,
          'Gastos del evento',
          `$ ${this.formatMoney(summary.totalGastosDb)}`,
          'Costos registrados',
          '#FFE4E6', // rojo rosado suave
        );

        // Card de balance final
        doc.save();
        doc
          .roundedRect(xRight, cardsY, cardWidth, cardHeight, 10)
          .fillOpacity(0.95)
          .fill('#FEF3C7'); // amarillo suave
        doc.fillOpacity(1);

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#6B7280')
          .text('Balance final del evento', xRight + 14, cardsY + 10);

        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor(resultadoColor)
          .text(
            `${balanceEsNegativo ? '-' : ''}$ ${this.formatMoney(balanceAbs)}`,
            xRight + 14,
            cardsY + 28,
          );

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#4B5563')
          .text(
            `Resultado: ${resultadoTexto}`,
            xRight + 14,
            cardsY + 52,
          );
        doc.restore();

        // Texto explicativo bajo las cards
        const textoY = cardsY + cardHeight + 30;
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#111827')
          .text('Resumen ejecutivo', marginX, textoY);

        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#374151')
          .text(
            balanceEsNegativo
              ? 'El evento cerró con una PÉRDIDA neta, es decir, los gastos superaron a los ingresos totales (boletos + ingresos adicionales).'
              : 'El evento cerró con una GANANCIA neta, es decir, los ingresos totales (boletos + ingresos adicionales) superaron a los gastos.',
            marginX,
            textoY + 18,
            {
              width: pageWidth - marginX * 2,
            },
          );

        // 🔢 Línea de totales: ingresos, gastos y resultado neto
        let infoY = doc.y + 10;

        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#4B5563')
          .text(
            `Ingresos totales (boletos + ingresos independientes): $ ${this.formatMoney(
              totalIngresosTotales,
            )}`,
            marginX,
            infoY,
          );

        doc.text(
          `Gastos totales: $ ${this.formatMoney(totalGastosTotales)}`,
          marginX,
          doc.y + 4,
        );

        doc
          .font('Helvetica-Bold')
          .fillColor(resultadoColor)
          .text(
            `Resultado neto (ingresos - gastos): ${
              balanceEsNegativo ? '-' : ''
            }$ ${this.formatMoney(balanceAbs)}`,
            marginX,
            doc.y + 4,
          );

        // ======================================================
        // 📄 PÁGINA 2: DETALLE DE INGRESOS
        // ======================================================
        doc.addPage();
        try {
          const bgPath = join(
            process.cwd(),
            'public',
            'finance',
            'report-bg.png',
          );
          doc.image(bgPath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
          });
        } catch {}

        const headerY2 = 80;

        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor('#111827')
          .text('Detalle de ingresos', marginX, headerY2);

        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#4B5563')
          .text(
            `Total ingresos (movimientos): $ ${this.formatMoney(
              totalIngresosMov,
            )}`,
            marginX,
            headerY2 + 22,
          );

        let y = headerY2 + 50;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#6B7280');
        doc.text('Fecha', marginX, y);
        doc.text('Descripción', marginX + 80, y);
        doc.text('Categoría', marginX + 260, y);
        doc.text('Medio', marginX + 360, y);
        doc.text('Monto', marginX + 430, y, { width: 80, align: 'right' });

        doc
          .moveTo(marginX, y + 14)
          .lineTo(pageWidth - marginX, y + 14)
          .stroke();

        y += 20;
        doc.font('Helvetica').fontSize(9).fillColor('#111827');

        let rowIndex = 0;

        for (const m of ingresos) {
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 60;
            rowIndex = 0;
          }

          // fondo alternado
          if (rowIndex % 2 === 0) {
            doc.save();
            doc
              .rect(marginX, y - 4, pageWidth - marginX * 2, 16)
              .fillOpacity(0.04)
              .fill('#3B82F6');
            doc.restore();
          }

          const fechaStr = new Date(m.fecha).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });

          doc.text(fechaStr, marginX, y);
          doc.text(m.descripcion ?? '-', marginX + 80, y, { width: 170 });
          doc.text(m.categoria?.nombre ?? '-', marginX + 260, y, { width: 90 });
          doc.text(m.medio_pago ?? '-', marginX + 360, y, { width: 50 });
          doc.text(
            this.formatMoney(m.monto),
            marginX + 430,
            y,
            { width: 80, align: 'right' },
          );

          y += 18;
          rowIndex++;
        }

        // ======================================================
        // 📄 PÁGINA 3: DETALLE DE GASTOS
        // ======================================================
        doc.addPage();
        try {
          const bgPath = join(
            process.cwd(),
            'public',
            'finance',
            'report-bg.png',
          );
          doc.image(bgPath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
          });
        } catch {}

        const headerY3 = 80;

        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor('#111827')
          .text('Detalle de gastos', marginX, headerY3);

        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#4B5563')
          .text(
            `Total gastos (movimientos): $ ${this.formatMoney(
              totalGastosMov,
            )}`,
            marginX,
            headerY3 + 22,
          );

        y = headerY3 + 50;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#6B7280');
        doc.text('Fecha', marginX, y);
        doc.text('Descripción', marginX + 80, y);
        doc.text('Categoría', marginX + 260, y);
        doc.text('Medio', marginX + 360, y);
        doc.text('Monto', marginX + 430, y, { width: 80, align: 'right' });

        doc
          .moveTo(marginX, y + 14)
          .lineTo(pageWidth - marginX, y + 14)
          .stroke();

        y += 20;
        doc.font('Helvetica').fontSize(9).fillColor('#111827');
        rowIndex = 0;

        for (const m of gastos) {
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 60;
            rowIndex = 0;
          }

          if (rowIndex % 2 === 0) {
            doc.save();
            doc
              .rect(marginX, y - 4, pageWidth - marginX * 2, 16)
              .fillOpacity(0.04)
              .fill('#EF4444');
            doc.restore();
          }

          const fechaStr = new Date(m.fecha).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });

          doc.text(fechaStr, marginX, y);
          doc.text(m.descripcion ?? '-', marginX + 80, y, { width: 170 });
          doc.text(m.categoria?.nombre ?? '-', marginX + 260, y, { width: 90 });
          doc.text(m.medio_pago ?? '-', marginX + 360, y, { width: 50 });
          doc.text(
            this.formatMoney(m.monto),
            marginX + 430,
            y,
            { width: 80, align: 'right' },
          );

          y += 18;
          rowIndex++;
        }

        // ======================================================
        // 📄 PÁGINA 4: RESUMEN POR CATEGORÍA
        // ======================================================
        doc.addPage();
        try {
          const bgPath = join(
            process.cwd(),
            'public',
            'finance',
            'report-bg.png',
          );
          doc.image(bgPath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
          });
        } catch {}

        const headerY4 = 80;

        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor('#111827')
          .text('Resumen por categoría', marginX, headerY4);

        y = headerY4 + 40;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#6B7280');
        doc.text('Categoría', marginX, y);
        doc.text('Ingresos', marginX + 220, y, { width: 80, align: 'right' });
        doc.text('Gastos', marginX + 320, y, { width: 80, align: 'right' });
        doc.text('Balance', marginX + 420, y, { width: 80, align: 'right' });

        doc
          .moveTo(marginX, y + 14)
          .lineTo(pageWidth - marginX, y + 14)
          .stroke();

        y += 20;
        rowIndex = 0;

        for (const cat of categoriasResumen) {
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 60;
            rowIndex = 0;
          }

          const balanceCatNeg = cat.balance < 0;
          const balanceCatAbs = Math.abs(cat.balance);

          if (rowIndex % 2 === 0) {
            doc.save();
            doc
              .rect(marginX, y - 4, pageWidth - marginX * 2, 16)
              .fillOpacity(0.035)
              .fill('#6366F1');
            doc.restore();
          }

          doc.font('Helvetica').fontSize(9).fillColor('#111827');
          doc.text(cat.nombre, marginX, y, { width: 200 });

          doc.text(
            this.formatMoney(cat.ingresos),
            marginX + 220,
            y,
            { width: 80, align: 'right' },
          );
          doc.text(
            this.formatMoney(cat.gastos),
            marginX + 320,
            y,
            { width: 80, align: 'right' },
          );

          doc
            .font('Helvetica-Bold')
            .fillColor(balanceCatNeg ? '#B71C1C' : '#1B5E20')
            .text(
              `${balanceCatNeg ? '-' : ''}$ ${this.formatMoney(balanceCatAbs)}`,
              marginX + 420,
              y,
              { width: 80, align: 'right' },
            );

          y += 18;
          rowIndex++;
        }

        doc.end();
      });
    } catch (err: any) {
      throw new BadRequestException(
        `Error al generar el análisis general: ${
          err?.message || 'Error desconocido.'
        }`,
      );
    }
  }

  // ============================================================
  // 📄 GENERAR PDF DE MOVIMIENTOS (CON MEMBRETE / POR FILTROS)
  // ============================================================
  async exportMovementsPdf(filters: ListMovementsArgs): Promise<Buffer> {
    try {
      const movimientos = await this.listMovements(filters)

      return await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({
          size: 'LETTER',
          margin: 40,
        })

        const chunks: Buffer[] = []
        doc.on('data', (chunk: Buffer) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', (err: Error) => reject(err))

        // Fondo membretado (opcional)
        try {
          const bgPath = join(
            process.cwd(),
            'public',
            'finance',
            'report-bg.png',
          )
          doc.image(bgPath, 0, 0, {
            width: doc.page.width,
            height: doc.page.height,
          })
        } catch {
          // Si no existe la imagen, solo se queda fondo blanco
        }

        // Encabezado
        doc
          .font('Helvetica-Bold')
          .fontSize(18)
          .fillColor('#000000')
          .text('Reporte de movimientos financieros', {
            align: 'center',
          })

        doc.moveDown(0.5)
        doc
          .font('Helvetica')
          .fontSize(11)
          .text(
            `Tipo: ${
              filters.tipo && filters.tipo !== 'ALL' ? filters.tipo : 'Todos'
            } · Categoría: ${
              filters.categoriaId ? filters.categoriaId : 'Todas'
            }`,
            { align: 'center' },
          )

        doc.moveDown(1)

        // Encabezados de tabla
        const startY = doc.y
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')

        doc.text('Fecha', 40, startY)
        doc.text('Tipo', 110, startY)
        doc.text('Descripción', 160, startY)
        doc.text('Categoría', 330, startY)
        doc.text('Medio', 430, startY)
        doc.text('Monto', 500, startY, { width: 80, align: 'right' })

        doc.moveTo(40, startY + 14).lineTo(560, startY + 14).stroke()

        // Filas
        doc.font('Helvetica').fontSize(10).fillColor('#000000')
        let y = startY + 20

        let totalIngresos = 0
        let totalGastos = 0

        for (const m of movimientos) {
          if (y > doc.page.height - 60) {
            doc.addPage()
            y = 40
          }

          const fechaStr = new Date(m.fecha).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })

          doc.text(fechaStr, 40, y)
          doc.text(m.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto', 110, y)
          doc.text(m.descripcion ?? '-', 160, y, { width: 160 })
          doc.text(m.categoria?.nombre ?? '-', 330, y, { width: 90 })
          doc.text(m.medio_pago ?? '-', 430, y, { width: 60 })
          doc.text(m.monto.toFixed(2), 500, y, { width: 80, align: 'right' })

          if (m.tipo === 'INGRESO') {
            totalIngresos += m.monto
          } else {
            totalGastos += m.monto
          }

          y += 18
        }

        const balance = totalIngresos - totalGastos
        const balanceEsNegativo = balance < 0
        const balanceAbs = Math.abs(balance)

        // Totales
        doc.moveDown(2)
        const totalsY = y + 10

        doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000')
        doc.text(`TOTAL INGRESOS: $${totalIngresos.toFixed(2)}`, 340, totalsY, {
          width: 240,
          align: 'right',
        })

        doc.text(`TOTAL GASTOS: $${totalGastos.toFixed(2)}`, 340, totalsY + 18, {
          width: 240,
          align: 'right',
        })

        // Balance en rojo si es negativo, verde si es positivo
        doc
          .font('Helvetica-Bold')
          .fontSize(13)
          .fillColor(balanceEsNegativo ? '#B71C1C' : '#1B5E20')
          .text(
            `BALANCE: ${balanceEsNegativo ? '-' : ''}$${balanceAbs.toFixed(2)}`,
            340,
            totalsY + 36,
            {
              width: 240,
              align: 'right',
            },
          )

        doc.end()
      })
    } catch (err: any) {
      throw new BadRequestException(
        `Error al generar el PDF de movimientos: ${
          err?.message || 'Error desconocido.'
        }`,
      )
    }
  }
}

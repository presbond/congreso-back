import {
  Injectable, BadRequestException, NotFoundException,
  ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async userHasApprovedPayment(userId: bigint): Promise<boolean> {
    try {
      const p = await this.prisma.payment.findFirst({
        where: { userId, paymentStatus: 'paid', status: 'complete' },
        select: { id: true },
      });
      return !!p;
    } catch {
      return false;
    }
  }

  private isUnlimited(max: number | null): boolean {
    return !max || max === 0;
    // null o 0 = ilimitado
  }

  /**
   * Inscribe al usuario en un taller (solo uno por usuario).
   * - Requiere pago verificado (users.status_event o payment paid/complete)
   * - Respeta cupo (0/NULL = ilimitado)
   * - Transacción: asigna workshop al usuario + actualiza spots_occupied
   * - Reconciliación: set spots_occupied = COUNT(users con ese workshop) al final
   */
  async enrollWorkshop(userId: bigint, workshopId: number) {
    if (!workshopId || workshopId < 1) {
      throw new BadRequestException('workshopId inválido');
    }

    const user = await this.prisma.users.findUnique({
      where: { user_id: userId },
      select: { user_id: true, status_event: true, workshop_id: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.workshop_id) throw new BadRequestException('Ya estás inscrito en un taller');

    const hasPayment = Boolean(user.status_event) || await this.userHasApprovedPayment(userId);
    if (!hasPayment) throw new ForbiddenException('Pago no verificado');

    const workshop = await this.prisma.workshop.findFirst({
      where: { workshop_id: BigInt(workshopId), status: 'active' },
      select: { workshop_id: true, name_workshop: true, spots_max: true, spots_occupied: true },
    });
    if (!workshop) throw new NotFoundException('Taller no encontrado');

    const max = workshop.spots_max ?? 0;
    const occ = workshop.spots_occupied ?? 0;
    const unlimited = this.isUnlimited(max);
    const available = unlimited ? Number.MAX_SAFE_INTEGER : Math.max(max - occ, 0);
    if (!unlimited && available <= 0) throw new ConflictException('Cupo lleno');

    return await this.prisma.$transaction(async (tx) => {
      // 1) Verificación de cupo “en vivo”
      if (!unlimited) {
        const w = await tx.workshop.findUnique({
          where: { workshop_id: BigInt(workshopId) },
          select: { spots_max: true, spots_occupied: true },
        });
        if (!w) throw new NotFoundException('Taller no encontrado');
        if ((w.spots_max ?? 0) > 0 && (w.spots_occupied ?? 0) >= (w.spots_max ?? 0)) {
          throw new ConflictException('Cupo agotado');
        }
      }

      // 2) Asignar el taller al usuario
      await tx.users.update({
        where: { user_id: userId },
        data: { workshop_id: BigInt(workshopId) },
      });

      // 3) Reconciliación exacta del cupo: contar usuarios y setear spots_occupied
      if (!unlimited) {
        const count = await tx.users.count({
          where: { workshop_id: BigInt(workshopId) },
        });

        await tx.workshop.update({
          where: { workshop_id: BigInt(workshopId) },
          data: { spots_occupied: count },
        });

        // Validación opcional: no exceder spots_max
        const w2 = await tx.workshop.findUnique({
          where: { workshop_id: BigInt(workshopId) },
          select: { spots_max: true, spots_occupied: true },
        });
        if ((w2?.spots_max ?? 0) > 0 && (w2?.spots_occupied ?? 0) > (w2?.spots_max ?? 0)) {
          // rollback implícito al lanzar error dentro de la transacción
          throw new ConflictException('Cupo excedido por concurrencia, intenta nuevamente.');
        }
      }

      return {
        ok: true,
        message: 'Inscripción realizada',
        user_id: Number(userId),
        workshop_id: Number(workshopId),
        workshop_name: workshop.name_workshop ?? '',
      };
    });
  }
}

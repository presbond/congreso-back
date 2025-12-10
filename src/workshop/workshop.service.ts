// src/workshop/workshop.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { WorkshopResponseDto } from './dto/workshop-response.dto';
import { status_enum } from '@prisma/client';

interface UserInfo {
  user_id: bigint;
  status_event: boolean | null;
  workshop_id: bigint | null;
}

@Injectable()
export class WorkshopService {
  constructor(private readonly prisma: PrismaService) {}

  // === Helpers comunes ===
  private isUnlimited(spotsMax?: number | null): boolean {
    return !spotsMax || spotsMax === 0;
  }

  private calcAvailable(spotsMax?: number | null, spotsOcc?: number | null): number {
    const max = spotsMax ?? 0;
    const occ = spotsOcc ?? 0;
    if (this.isUnlimited(max)) return Number.MAX_SAFE_INTEGER;
    return Math.max(max - occ, 0);
  }

  private buildInstructorName(
    instructor_name?: string | null,
    rel?: { name_user?: string | null; paternal_surname?: string | null; maternal_surname?: string | null } | null
  ): string {
    if (instructor_name && instructor_name.trim().length > 0) return instructor_name.trim();
    if (!rel) return '';
    return `${rel.name_user || ''} ${rel.paternal_surname || ''} ${rel.maternal_surname || ''}`.trim();
  }

  private async userHasApprovedPayment(userId: bigint): Promise<boolean> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: {
          userId,
          paymentStatus: 'paid',
          status: 'complete',
        },
      });
      return !!payment;
    } catch (error) {
      console.error(`[WorkshopService] Error verificando pago para usuario ${userId}:`, error);
      return false;
    }
  }

  private determineEnrollmentStatus(
    isAuthenticated: boolean,
    hasPayment: boolean,
    isEnrolled: boolean,
    availableSpots: number,
    userWorkshopId: number | null,
    currentWorkshopId: number
  ) {
    if (!isAuthenticated) {
      return {
        enrollment_status: 'not_authenticated',
        can_enroll: false,
        button_text: 'Inscribirse',
        button_disabled: true,
        button_type: 'default',
      };
    }

    if (isEnrolled || userWorkshopId === currentWorkshopId) {
      return {
        enrollment_status: 'already_enrolled',
        can_enroll: false,
        button_text: 'Ya inscrito',
        button_disabled: true,
        button_type: 'success',
      };
    }

    if (!hasPayment) {
      return {
        enrollment_status: 'needs_payment',
        can_enroll: false,
        button_text: 'Completar Pago',
        button_disabled: false,
        button_type: 'warning',
      };
    }

    if (availableSpots > 0 || availableSpots === Number.MAX_SAFE_INTEGER) {
      return {
        enrollment_status: 'can_enroll',
        can_enroll: true,
        button_text: 'Inscribirse',
        button_disabled: false,
        button_type: 'default',
      };
    }

    return {
      enrollment_status: 'no_spots',
      can_enroll: false,
      button_text: 'Sin Cupos',
      button_disabled: true,
      button_type: 'danger',
    };
  }

  // === LISTA ===
  async getAllWorkshops(userId?: number): Promise<WorkshopResponseDto[]> {
    try {
      const workshops = await this.prisma.workshop.findMany({
        where: { status: 'active' },
        include: {
          // relación al usuario-instructor (opcional)
          users_workshop_instructor_user_idTousers: {
            select: { user_id: true, name_user: true, paternal_surname: true, maternal_surname: true },
          },
          // relación para saber si ESTE usuario está inscrito aquí
          users_users_workshop_idToworkshop: userId
            ? { where: { user_id: BigInt(userId) }, select: { user_id: true } }
            : false,
        },
        orderBy: { created_at: 'desc' },
      });

      let userInfo: UserInfo | null = null;
      let hasPayment = false;
      if (userId) {
        userInfo = await this.prisma.users.findUnique({
          where: { user_id: BigInt(userId) },
          select: { user_id: true, status_event: true, workshop_id: true },
        });
        if (userInfo) {
          hasPayment = Boolean(userInfo.status_event) || (await this.userHasApprovedPayment(BigInt(userId)));
        }
      }

      return workshops.map((w) => {
        const isUserEnrolled = !!userId && (w.users_users_workshop_idToworkshop?.length ?? 0) > 0;
        const userWorkshopId = userInfo?.workshop_id ? Number(userInfo.workshop_id) : null;
        const currentWorkshopId = Number(w.workshop_id);

        const availableSpots = this.calcAvailable(w.spots_max, w.spots_occupied);
        const enrollmentInfo = this.determineEnrollmentStatus(
          !!userId,
          hasPayment,
          isUserEnrolled,
          availableSpots,
          userWorkshopId,
          currentWorkshopId,
        );

        return {
          workshop_id: currentWorkshopId,
          name_workshop: w.name_workshop || '',
          descript: w.descript || '',
          spots_max: w.spots_max || 0,
          spots_occupied: w.spots_occupied || 0,
          available_spots: availableSpots,
          building: w.building || '',
          classroom: w.classroom || '',
          status: w.status || status_enum.active,
          instructor_user_id: w.instructor_user_id ? Number(w.instructor_user_id) : undefined,
          created_at: w.created_at || undefined,
          updated_at: w.updated_at || undefined,

          // NUEVOS
          instructor_name: this.buildInstructorName(
            // preferir columna nueva si viene
            (w as any).instructor_name,
            w.users_workshop_instructor_user_idTousers,
          ),
          level: (w as any).level ?? undefined,
          category: (w as any).category ?? undefined,
          tools: (w as any).tools ?? undefined,

          // Estado de inscripción
          is_user_enrolled: isUserEnrolled,
          can_enroll: enrollmentInfo.can_enroll,
          enrollment_status: enrollmentInfo.enrollment_status,
          button_text: enrollmentInfo.button_text,
          button_disabled: enrollmentInfo.button_disabled,
          button_type: enrollmentInfo.button_type,
        };
      });
    } catch (error: any) {
      console.error('[WorkshopService] Error obteniendo talleres:', error);
      if (error.code === 'P1001' || error.code === 'P1017') {
        throw new ServiceUnavailableException('No es posible conectar a la base de datos en este momento.');
      }
      throw new InternalServerErrorException('Error al obtener los talleres');
    }
  }

  // === DETALLE ===
  async getWorkshopById(id: number, userId?: number): Promise<WorkshopResponseDto> {
    try {
      const w = await this.prisma.workshop.findFirst({
        where: { workshop_id: BigInt(id), status: 'active' },
        include: {
          users_workshop_instructor_user_idTousers: {
            select: { user_id: true, name_user: true, paternal_surname: true, maternal_surname: true },
          },
          users_users_workshop_idToworkshop: userId
            ? { where: { user_id: BigInt(userId) }, select: { user_id: true } }
            : false,
          schedule: {
            select: { schedule_id: true, name_conference: true, day_week: true, assigned_date: true, start_time: true, end_time: true },
          },
        },
      });

      if (!w) throw new NotFoundException(`Taller con ID ${id} no encontrado`);

      let userInfo: UserInfo | null = null;
      let hasPayment = false;
      if (userId) {
        userInfo = await this.prisma.users.findUnique({
          where: { user_id: BigInt(userId) },
          select: { user_id: true, status_event: true, workshop_id: true },
        });
        if (userInfo) {
          hasPayment = Boolean(userInfo.status_event) || (await this.userHasApprovedPayment(BigInt(userId)));
        }
      }

      const isUserEnrolled = !!userId && (w.users_users_workshop_idToworkshop?.length ?? 0) > 0;
      const userWorkshopId = userInfo?.workshop_id ? Number(userInfo.workshop_id) : null;
      const currentWorkshopId = Number(w.workshop_id);

      const availableSpots = this.calcAvailable(w.spots_max, w.spots_occupied); // <- unificado
      const enrollmentInfo = this.determineEnrollmentStatus(
        !!userId,
        hasPayment,
        isUserEnrolled,
        availableSpots,
        userWorkshopId,
        currentWorkshopId,
      );

      return {
        workshop_id: currentWorkshopId,
        name_workshop: w.name_workshop || '',
        descript: w.descript || '',
        spots_max: w.spots_max || 0,
        spots_occupied: w.spots_occupied || 0,
        available_spots: availableSpots,
        building: w.building || '',
        classroom: w.classroom || '',
        status: w.status || status_enum.active,
        instructor_user_id: w.instructor_user_id ? Number(w.instructor_user_id) : undefined,
        created_at: w.created_at || undefined,
        updated_at: w.updated_at || undefined,

        // NUEVOS
        instructor_name: this.buildInstructorName(
          (w as any).instructor_name,
          w.users_workshop_instructor_user_idTousers,
        ),
        level: (w as any).level ?? undefined,
        category: (w as any).category ?? undefined,
        tools: (w as any).tools ?? undefined,

        // UI / user state
        is_user_enrolled: isUserEnrolled,
        can_enroll: enrollmentInfo.can_enroll,
        enrollment_status: enrollmentInfo.enrollment_status,
        button_text: enrollmentInfo.button_text,
        button_disabled: enrollmentInfo.button_disabled,
        button_type: enrollmentInfo.button_type,
      };
    } catch (error: any) {
      console.error(`[WorkshopService] Error obteniendo taller ID ${id}:`, error);
      if (error.code === 'P1001' || error.code === 'P1017') {
        throw new ServiceUnavailableException('No es posible conectar a la base de datos en este momento.');
      }
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al obtener el taller');
    }
  }

  // === DISPONIBLES ===
  async getAvailableWorkshops(userId?: number): Promise<WorkshopResponseDto[]> {
    try {
      const workshops = await this.prisma.workshop.findMany({
        where: {
          status: 'active',
          OR: [
            { spots_max: { gt: this.prisma.workshop.fields.spots_occupied } },
            { spots_max: null }, // ilimitado
            { spots_max: 0 },    // ilimitado
          ],
        },
        include: {
          users_workshop_instructor_user_idTousers: {
            select: { user_id: true, name_user: true, paternal_surname: true, maternal_surname: true },
          },
          users_users_workshop_idToworkshop: userId
            ? { where: { user_id: BigInt(userId) }, select: { user_id: true } }
            : false,
        },
        orderBy: { name_workshop: 'asc' },
      });

      let userInfo: UserInfo | null = null;
      let hasPayment = false;
      if (userId) {
        userInfo = await this.prisma.users.findUnique({
          where: { user_id: BigInt(userId) },
          select: { user_id: true, status_event: true, workshop_id: true },
        });
        if (userInfo) {
          hasPayment = Boolean(userInfo.status_event) || (await this.userHasApprovedPayment(BigInt(userId)));
        }
      }

      return workshops.map((w) => {
        const isUserEnrolled = !!userId && (w.users_users_workshop_idToworkshop?.length ?? 0) > 0;
        const userWorkshopId = userInfo?.workshop_id ? Number(userInfo.workshop_id) : null;
        const currentWorkshopId = Number(w.workshop_id);

        const availableSpots = this.calcAvailable(w.spots_max, w.spots_occupied); // <- unificado
        const enrollmentInfo = this.determineEnrollmentStatus(
          !!userId,
          hasPayment,
          isUserEnrolled,
          availableSpots,
          userWorkshopId,
          currentWorkshopId,
        );

        return {
          workshop_id: currentWorkshopId,
          name_workshop: w.name_workshop || '',
          descript: w.descript || '',
          spots_max: w.spots_max || 0,
          spots_occupied: w.spots_occupied || 0,
          available_spots: availableSpots,
          building: w.building || '',
          classroom: w.classroom || '',
          status: w.status || status_enum.active,
          instructor_user_id: w.instructor_user_id ? Number(w.instructor_user_id) : undefined,
          created_at: w.created_at || undefined,
          updated_at: w.updated_at || undefined,

          // NUEVOS
          instructor_name: this.buildInstructorName(
            (w as any).instructor_name,
            w.users_workshop_instructor_user_idTousers,
          ),
          level: (w as any).level ?? undefined,
          category: (w as any).category ?? undefined,
          tools: (w as any).tools ?? undefined,

          // Estado de inscripción
          is_user_enrolled: isUserEnrolled,
          can_enroll: enrollmentInfo.can_enroll,
          enrollment_status: enrollmentInfo.enrollment_status,
          button_text: enrollmentInfo.button_text,
          button_disabled: enrollmentInfo.button_disabled,
          button_type: enrollmentInfo.button_type,
        };
      });
    } catch (error: any) {
      console.error('[WorkshopService] Error obteniendo talleres disponibles:', error);
      if (error.code === 'P1001' || error.code === 'P1017') {
        throw new ServiceUnavailableException('No es posible conectar a la base de datos en este momento.');
      }
      throw new InternalServerErrorException('Error al obtener los talleres disponibles');
    }
  }
}

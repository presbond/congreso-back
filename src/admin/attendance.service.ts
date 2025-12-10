// src/admin/attendance.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // 📌 Escanear QR y registrar asistencia
  // ============================================================
  async scanQr(dto: ScanQrDto) {
    // Soporte tanto para qrValue (DTO) como para token (por si el front ya lo usa)
    const rawInput =
      (dto.qrValue ?? (dto as any).token ?? '').toString().trim();

    if (!rawInput) {
      throw new BadRequestException('QR vacío.');
    }

    const raw = rawInput;

    // Podemos encontrar al usuario por: email, matrícula o id numérico
    const orConditions: any[] = [
      { matricula: raw },
      { email: raw.toLowerCase() },
    ];

    const asNumber = Number(raw);
    if (Number.isFinite(asNumber)) {
      orConditions.push({ user_id: BigInt(asNumber) });
    }

    const user = await this.prisma.users.findFirst({
      where: {
        OR: orConditions,
      },
      include: {
        type_user: { select: { name_type: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('QR no válido o usuario no encontrado.');
    }

    // Debe tener status_event = true (pagado / habilitado)
    if (!user.status_event) {
      throw new ForbiddenException(
        'El usuario no tiene pago confirmado para el evento.',
      );
    }

    // Taller seleccionado (opcional)
    let workshop: any = null;
    if (dto.workshopId) {
      workshop = await this.prisma.workshop.findUnique({
        where: { workshop_id: BigInt(dto.workshopId) },
      });

      if (!workshop) {
        throw new NotFoundException('Taller / evento no encontrado.');
      }
    }

    // Creamos (o reutilizamos) un registro de qr_code para este taller + token
    // solo si workshopId viene; si no, dejamos attendance sin qr_code_id.
    let qrCodeId: bigint | null = null;

    if (dto.workshopId) {
      const existingQr = await this.prisma.qr_code.findFirst({
        where: {
          token: raw,
          workshop_id: BigInt(dto.workshopId),
        },
      });

      let qr = existingQr;
      if (!qr) {
        qr = await this.prisma.qr_code.create({
          data: {
            token: raw,
            workshop_id: BigInt(dto.workshopId),
          },
        });
      }
      qrCodeId = qr.qr_code_id;
    }

    // ¿Ya se registró asistencia para este usuario (y este qr_code/taller)?
    const existingAttendance = await this.prisma.attendance.findFirst({
      where: {
        user_id: user.user_id,
        ...(qrCodeId ? { qr_code_id: qrCodeId } : {}),
      },
    });

    let attendance;
    let alreadyRegistered = false;

    if (existingAttendance) {
      attendance = existingAttendance;
      alreadyRegistered = true;
    } else {
      attendance = await this.prisma.attendance.create({
        data: {
          user_id: user.user_id,
          ...(qrCodeId ? { qr_code_id: qrCodeId } : {}),
          // date_time usa el default(now())
        },
      });
    }

    const fullName = [
      user.name_user,
      user.paternal_surname,
      user.maternal_surname,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      status: alreadyRegistered ? 'already_registered' : 'ok',
      message: alreadyRegistered
        ? 'La asistencia ya había sido registrada anteriormente.'
        : 'Asistencia registrada correctamente.',
      attendanceId: Number(attendance.attendance_id),
      at: attendance.date_time,
      user: {
        id: Number(user.user_id),
        name: fullName,
        email: user.email,
        matricula: user.matricula,
        type: user.type_user?.name_type ?? 'Externo',
        status_event: user.status_event,
      },
      workshop: workshop
        ? {
            id: Number(workshop.workshop_id),
            name: workshop.name_workshop,
            building: workshop.building,
            classroom: workshop.classroom,
            category: workshop.category,
          }
        : null,
    };
  }

  // ============================================================
  // 📌 Listar talleres/eventos para el selector del front
  // ============================================================
  async listWorkshopsForAttendance() {
    const workshops = await this.prisma.workshop.findMany({
      select: {
        workshop_id: true,
        name_workshop: true,
        building: true,
        classroom: true,
        category: true,
        status: true,
        schedule: {
          select: {
            schedule_id: true,
            name_conference: true,
            assigned_date: true,
            start_time: true,
            end_time: true,
          },
        },
      },
      orderBy: {
        name_workshop: 'asc',
      },
    });

    const mapped = workshops.map((w) => ({
      id: Number(w.workshop_id),
      name: w.name_workshop,
      building: w.building,
      classroom: w.classroom,
      category: w.category,
      status: w.status,
      schedules: w.schedule.map((s) => ({
        id: Number(s.schedule_id),
        name: s.name_conference,
        date: s.assigned_date,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
    }));

    // El front puede leer directamente `res.workshops`
    return {
      workshops: mapped,
    };
  }

  // src/admin/attendance.service.ts
  // ============================================================
  // 📌 Listas de usuarios de un taller, agrupados por tipo
  //     - Incluye inscritos (users.workshop_id = taller)
  //     - Incluye quienes pasaron lista aunque no estén inscritos
  //     - Marca attended = true/false
  // ============================================================
  async listWorkshopUsersByType(workshopId: number) {
    const wid = BigInt(workshopId);

    const workshop = await this.prisma.workshop.findUnique({
      where: { workshop_id: wid },
    });

    if (!workshop) {
      throw new NotFoundException('Taller / evento no encontrado.');
    }

    // 1) Asistencias registradas para ese taller (via qr_code.workshop_id)
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        qr_code: {
          workshop_id: wid,
        },
      },
      include: {
        users: {
          include: {
            type_user: true,
          },
        },
      },
      orderBy: {
        date_time: 'asc',
      },
    });

    // 2) Usuarios inscritos al taller aunque aún no hayan pasado lista
    const enrolledUsers = await this.prisma.users.findMany({
      where: {
        workshop_id: wid,
      },
      include: {
        type_user: true,
      },
    });

    type AggregatedUser = {
      user: any;
      attended: boolean;
      attendance_time: Date | null;
    };

    const map = new Map<bigint, AggregatedUser>();

    const ensureUser = (u: any): AggregatedUser => {
      let agg = map.get(u.user_id as bigint);
      if (!agg) {
        agg = {
          user: u,
          attended: false,
          attendance_time: null,
        };
        map.set(u.user_id as bigint, agg);
      }
      return agg;
    };

    // 2a) Pre-cargar inscritos como "pendientes"
    for (const u of enrolledUsers) {
      ensureUser(u);
    }

    // 1b) Marcar los que pasaron lista (aunque no estén inscritos)
    for (const rec of attendanceRecords) {
      const u = rec.users;
      if (!u) continue;

      const agg = ensureUser(u);
      agg.attended = true;

      if (!agg.attendance_time || (rec.date_time && rec.date_time > agg.attendance_time)) {
        agg.attendance_time = rec.date_time;
      }
    }

    // 3) Construir arreglo "all"
    const all = Array.from(map.values()).map(({ user, attended, attendance_time }) => {
      const fullName = [
        user.name_user,
        user.paternal_surname,
        user.maternal_surname,
      ]
        .filter(Boolean)
        .join(' ');

      const typeName = user.type_user?.name_type ?? 'Externo';

      return {
        id: Number(user.user_id),
        name: fullName,
        email: user.email,
        matricula: user.matricula,
        status_event: user.status_event,
        type: typeName,
        attended,
        attendance_time,
      };
    });

    // 4) Agrupar por tipo
    const byType: Record<string, typeof all> = {};

    for (const u of all) {
      const key = u.type || 'Externo';
      if (!byType[key]) byType[key] = [];
      byType[key].push(u);
    }

    return {
      workshop: {
        id: Number(workshop.workshop_id),
        name: workshop.name_workshop,
        building: workshop.building,
        classroom: workshop.classroom,
        category: workshop.category,
      },
      all,
      byType,
    };
  }
}

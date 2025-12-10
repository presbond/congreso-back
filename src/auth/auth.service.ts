// src/auth/auth.service.ts
import {
  UnauthorizedException,
  NotFoundException,
  Injectable,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  Inject,
 ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import {
  VERIFICATION_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,
} from '@/common/tokens.constants';
import { PrismaService } from '@prisma/prisma.service';
import { CreateUserDto } from '@auth/dto/create-user.dto';
import { CreateLoginDto } from '@auth/dto/create-login.dto';
import { VerifyCodeDto } from '@auth/dto/verify-code.dto';
import { ResendCodeDto } from '@auth/dto/resend-code.dto';
import { ForgotPasswordDto } from '@auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@auth/dto/reset-password.dto';

import { normalizeGrade, normalizeGroup } from '@/common/utils/normalize-academics';

import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '@/auth/validation/email/email.service';
import { Prisma, size_enum, status_user } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { nanoid } from 'nanoid';
import { Response } from 'express';

type Tx = Prisma.TransactionClient;

// Tipo explícito para el resultado del login
export type LoginResult =
  | { 
      message: string; 
      accessToken: string; 
      refreshToken: string; 
      user_id: number;
      user: {
        user_id: number;
        email: string;
        type_user_id: number | null;
        type_user_name: string | null;
      };
    }
  | {
      require_verification: true;
      message: string;
      user: { 
        user_id: number; 
        email: string; 
        name_user?: string;
      };
      verify_token?: string;
    };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: any,
  ) {}

  private generateUniqueToken(): string {
    return nanoid(10);
  }

  /** Crea/actualiza URLs de redes sociales del usuario */
  private async createOrLinkSocials(db: Tx, userId: bigint, dto: CreateUserDto) {
    const wanted = [
      { name: 'Facebook', url: dto.facebook_link },
      { name: 'Instagram', url: dto.instagram_link },
      { name: 'X', url: dto.x_link },
      { name: 'Linkedin', url: dto.linkedin_link },
    ].filter((x) => !!x.url);

    for (const { name, url } of wanted) {
      const red = await db.red_social.findFirst({
        where: { nombre: { equals: name, mode: 'insensitive' } },
        select: { red_social_id: true },
      });
      if (!red) continue;

      const existing = await db.url_red_social.findFirst({
        where: { user_id: userId, red_social_id: red.red_social_id },
        select: { url_red_social_id: true },
      });

      if (existing) {
        await db.url_red_social.update({
          where: { url_red_social_id: existing.url_red_social_id },
          data: { url: url! },
        });
      } else {
        await db.url_red_social.create({
          data: {
            url: url!,
            red_social: { connect: { red_social_id: red.red_social_id } },
            users: { connect: { user_id: userId } },
          },
        });
      }
    }
  }

  /** Transacción corta para crear el bundle de ponente/tallerista */
  private async createSpeakerBundleTx(userId: bigint, dto: CreateUserDto) {
    const isTaller =
      dto.tipo_presentacion === 'taller' || dto.tipo_presentacion === 'ambas';
    const isConference =
      dto.tipo_presentacion === 'conferencia' ||
      dto.tipo_presentacion === 'ambas';

    return await this.prisma.$transaction(
      async (tx) => {
        // 1) Perfil de ponente
        await tx.speaker_profiles.create({
          data: {
            name_company: dto.empresa_procedencia ?? null,
            rol_company: dto.rol_dentro_empresa ?? null,
            rol_event: dto.tipo_presentacion ?? null,
            personal_description: dto.descripcion_biografia ?? null,
            user_id: userId,
          },
        });

        // 2) Taller (workshop) + QR si aplica
        if (isTaller) {
          const workshop = await tx.workshop.create({
            data: {
              name_workshop: dto.titulo_taller || null,
              descript: dto.descripcion_taller || null,
              status: 'active',
              users_workshop_instructor_user_idTousers: {
                connect: { user_id: userId },
              },
            },
            select: { workshop_id: true },
          });

          const qrToken = this.generateUniqueToken();
          await tx.qr_code.create({
            data: {
              token: qrToken,
              workshop: { connect: { workshop_id: workshop.workshop_id } },
            },
          });
        }

        // 3) Conferencia (schedule) si aplica
        if (isConference) {
          await tx.schedule.create({
            data: {
              name_conference: dto.titulo_conferencia || null,
              descript: dto.descripcion_conferencia || null,
              users: { connect: { user_id: userId } }, // speaker_id
            },
          });
        }

        // 4) Redes sociales (opcionales)
        await this.createOrLinkSocials(tx, userId, dto);
      },
      { timeout: 15000 }, // suficiente, sin incluir envío de correo
    );
  }

  // ============================
  // REGISTRO DE USUARIO
  // ============================
  private issueVerifyCookie(userId: bigint, userEmail: string, res?: Response) {
    const verifyJwt = this.jwtService.sign(
      { purpose: 'email_verification', uid: Number(userId), email: userEmail },
      {
        expiresIn: Number(process.env.JWT_VERIFY_EXPIRES_IN) || 900, // 15 minutos
        audience: 'email-verify',
        issuer: 'auth-service',
      },
    );
    if (res) {
      const secure = process.env.NODE_ENV === 'production';
      res.cookie('verify', verifyJwt, {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
      return;
    }
    return verifyJwt;
  }

  private async handleExistingInactiveUser(existing, res?: Response) {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

    await this.prisma.verification_token.create({
      data: {
        token: newCode,
        token_type: 'email_verification',
        user_id: existing.user_id,
        used: false,
        attempts: 0,
        expires_at: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    });

    await this.emailService.sendVerificationCode(existing.email, newCode);
    const fallbackVerifyToken = this.issueVerifyCookie(
      existing.user_id,
      existing.email,
      res,
    );

    return {
      message:
        'Este correo ya tiene un registro pendiente. Te reenviamos un nuevo código de verificación.',
      email_sent: true,
      ...(fallbackVerifyToken ? { verify_token: fallbackVerifyToken } : {}),
      user: { user_id: Number(existing.user_id) },
      already_exists: true,
    };
  }

  async createUser(dto: CreateUserDto, res?: Response) {
    const email = dto.email.toLowerCase().trim();
    const typeUserId = Number(dto.type_user_id);
    const isSpeaker = typeUserId === 4;
    const provenance = (dto.provenance || '').trim();
    const provLower = provenance.toLowerCase();

    // ✅ Normaliza grado/grupo desde el DTO (resuelve "1°", " a ", etc.)
    const gradeNorm = normalizeGrade(dto.grade ?? null);
    const groupNorm = normalizeGroup(dto.group_user ?? null);

    // Reglas previas
    if (isSpeaker) {
      const secret = (process.env.SPEAKER_SECRET || '').trim();
      if (!secret || (dto.secret_password || '').trim() !== secret) {
        throw new UnauthorizedException('Contraseña de ponente inválida');
      }
    }

    // Estudiante (1) o Docente UTTECAM (2 + provenance = uttecam) => requieren matrícula y programa
    const isUttecamStudent = typeUserId === 1 && provLower === 'uttecam';
    const isUttecamCollaborator = typeUserId === 2 && provLower === 'uttecam';

    if (isUttecamStudent || isUttecamCollaborator) {
      if (!dto.matricula || !dto.educational_program) {
        throw new BadRequestException('Faltan datos académicos');
      }
    }

    if (!dto.size_user) {
      throw new BadRequestException('Debes seleccionar una talla');
    }

    const hashedPassword = await bcrypt.hash(dto.password_user, 12);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      const existing = await this.prisma.users.findUnique({
        where: { email },
        select: { user_id: true, status: true, email: true },
      });

      if (existing) {
        if (existing.status === 'active') {
          throw new ConflictException('El correo ya está registrado y activo');
        }
        return this.handleExistingInactiveUser(existing, res);
      }

      // 🎯 Construir payload base del usuario con valores normalizados
      const baseData: Prisma.usersCreateInput = {
        name_user: dto.name_user,
        paternal_surname: dto.paternal_surname,
        maternal_surname: dto.maternal_surname,
        phone: dto.phone, // E.164 ya viene del FE
        emergency_phone: dto.emergency_phone ?? null,
        email,
        password_user: hashedPassword,
        size_user: dto.size_user as size_enum,
        status: 'inactive' as status_user,
        type_user: { connect: { type_user_id: BigInt(typeUserId) } },
        verification_token: {
          create: {
            token: verificationCode,
            token_type: 'email_verification',
            used: false,
            attempts: 0,
            expires_at: new Date(Date.now() + VERIFICATION_TTL_MS),
          },
        },
        ...(typeUserId === 4 ? {} : { /* nada académico por ahora */ }),
        ...(typeUserId === 3 ? {} : {
          provenance: (dto.provenance || '').trim() || null,
        }),
        ...((typeUserId === 1 || typeUserId === 2) &&
        (dto.provenance || '').toLowerCase() === 'uttecam'
          ? {
              matricula: dto.matricula?.trim() || null,
              educational_program: dto.educational_program?.trim() || null,
              grade: typeUserId === 1 ? gradeNorm : null,
              group_user: typeUserId === 1 ? groupNorm : null,
            }
          : {}),
      };

      // Campos por tipo
      if (typeUserId === 4) {
        // Ponente: NO poner campos académicos
        baseData.provenance = null;
        baseData.educational_program = null;
        baseData.grade = null;
        baseData.group_user = null;
        baseData.matricula = null;
      } else if (typeUserId === 3) {
        // Externo: Solo procedencia y talla
        baseData.provenance = 'externo';
        baseData.educational_program = null;
        baseData.grade = null;
        baseData.group_user = null;
        baseData.matricula = null;
      } else {
        // 1/2 (alumno/docente) — guardar según procedencia
        baseData.provenance = provenance || null;

        if (provLower === 'uttecam') {
          baseData.matricula = dto.matricula?.trim() || null;
          baseData.educational_program = dto.educational_program?.trim() || null;
          // ✅ alumno: guarda normalizado
          baseData.grade = typeUserId === 1 ? gradeNorm : null;
          baseData.group_user = typeUserId === 1 ? groupNorm : null;
        } else {
          baseData.matricula = null;
          baseData.educational_program = null;
          baseData.grade = null;
          baseData.group_user = null;
        }
      }

      // 1) Crear usuario
      const user = await this.prisma.users.create({
        data: baseData,
        select: { user_id: true, name_user: true, email: true },
      });

      // 2) Enviar verificación (no bloqueante)
      try {
        await this.emailService.sendVerificationCode(user.email, verificationCode);
      } catch (mailErr) {
      }

      // 3) Ponente: crear bundle
      if (typeUserId === 4) {
        try {
          await this.createSpeakerBundleTx(user.user_id, dto);
        } catch (e) {
          //console.error('[AuthService] Error creando bundle ponente:', e);
          throw new InternalServerErrorException(
            'No se pudo completar el registro de ponente. Intenta de nuevo.',
          );
        }
      }

      // 4) Cookie de verificación (opcional)
      const fallbackVerifyToken = this.issueVerifyCookie(user.user_id, user.email, res);

      return {
        message: 'Usuario creado. Revisa tu correo para el código.',
        email_sent: true,
        ...(fallbackVerifyToken ? { verify_token: fallbackVerifyToken } : {}),
        user: { user_id: Number(user.user_id), name_user: user.name_user },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('El correo ya está registrado.');
        }
        if (error.code === 'P1001' || error.code === 'P1017') {
          throw new ServiceUnavailableException(
            'No es posible conectar a la base de datos en este momento. Intenta nuevamente más tarde.',
          );
        }
      }
      if (error instanceof Prisma.PrismaClientInitializationError) {
        throw new ServiceUnavailableException(
          'No es posible conectar a la base de datos en este momento.',
        );
      }
      if (error instanceof HttpException) throw error;

      //console.error('[AuthService] Error durante createUser:', error);
      throw new InternalServerErrorException('Error al registrar usuario');
    }
  }

  // ======= Resto de métodos (sin cambios funcionales relevantes) =======

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    
    // Buscar usuario activo
    const user = await this.prisma.users.findUnique({ 
      where: { email },
      select: { user_id: true, email: true, status: true }
    });
    
    // Por seguridad, no revelar si el usuario existe o no
    if (!user || user.status !== 'active') {
      return { 
        message: 'Si el email existe y está activo, recibirás un código de recuperación' 
      };
    }

    // Invalidar tokens de reset anteriores
    await this.prisma.verification_token.updateMany({
      where: {
        user_id: user.user_id,
        token_type: 'reset_password',
        used: false,
      },
      data: { used: true },
    });

    // Generar nuevo código
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    await this.prisma.verification_token.create({
      data: {
        token: code,
        token_type: 'reset_password',
        user_id: user.user_id,
        used: false,
        attempts: 0,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
      },
    });

    // Enviar email
    await this.emailService.sendVerificationCode(user.email, code);
    
    return { 
      message: 'Código de recuperación enviado, revisa tu correo',
      email_sent: true
    };
  }

  // src/auth/auth.service.ts (método resetPassword)
  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    // ✅ buscar token de tipo reset_password
    const token = await this.prisma.verification_token.findFirst({
      where: {
        user_id: user.user_id,
        token: dto.code,
        token_type: 'reset_password',
        used: false,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!token) {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    const hashed = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { user_id: user.user_id },
        data: { password_user: hashed },
      });

      // ✅ CORREGIDO: Marcar este token como usado en resetPassword
      await tx.verification_token.update({
        where: { verification_token_id: token.verification_token_id },
        data: { used: true, used_at: new Date() },
      });

      // Invalidar otros tokens de reset pendientes
      await tx.verification_token.updateMany({
        where: {
          user_id: user.user_id,
          token_type: 'reset_password',
          used: false,
          verification_token_id: { not: token.verification_token_id },
        },
        data: { used: true },
      });
    });

    return { message: 'Contraseña actualizada correctamente' };
  }


  async loginUser(dto: CreateLoginDto): Promise<LoginResult> {
    try {
      const email = dto.email.toLowerCase().trim();
      
      // Buscar usuario con timeout
      const user = await Promise.race([
        this.prisma.users.findUnique({
          where: { email },
          select: {
            user_id: true,
            email: true,
            password_user: true,
            status: true,
            name_user: true,
            type_user_id: true,
            type_user: { select: { name_type: true } },
          },
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DATABASE_TIMEOUT')), 10000)
        )
      ]) as any;

      if (!user) {
        throw new UnauthorizedException('Correo o contraseña incorrecta');
      }

      // Verificar contraseña PRIMERO
      const isPasswordValid = await bcrypt.compare(dto.password, user.password_user);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Correo o contraseña incorrecta'); // ✅ Corregido typo
      }

      // Verificar si la cuenta requiere verificación
      // En tu auth.service.ts - el método loginUser ya está bien
  // Solo verifica que esta parte esté presente:
    if (user.status !== 'active') {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      try {
        // Invalidar tokens anteriores y crear nuevo
        await this.prisma.verification_token.updateMany({
          where: {
            user_id: user.user_id,
            token_type: 'email_verification',
            used: false,
          },
          data: { used: true },
        });

        await this.prisma.verification_token.create({
          data: {
            token: newCode,
            token_type: 'email_verification',
            user_id: user.user_id,
            used: false,
            attempts: 0,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
          },
        });

        // Enviar email
        await this.emailService.sendVerificationCode(user.email, newCode);

        const fallbackVerifyToken = this.issueVerifyCookie(user.user_id, user.email);

        const result: LoginResult = {
          require_verification: true,
          message: 'Tu cuenta está inactiva. Revisa tu correo para el código de verificación.',
          user: {
            user_id: Number(user.user_id),
            email: user.email,
            name_user: user.name_user ?? undefined,
          },
          ...(fallbackVerifyToken ? { verify_token: fallbackVerifyToken } : {}),
        };
        return result;
      } catch (verificationError) {
        //console.error('Error creando token de verificación:', verificationError);
        throw new InternalServerErrorException('Error al generar código de verificación');
      }
    }

      // Cuenta activa - generar tokens
      const payload = {
        userId: Number(user.user_id),
        email: user.email,
        roleId: Number(user.type_user_id),
        roleName: user.type_user?.name_type || null,
      };

      // Generar tokens
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: Number(process.env.JWT_ACCESS_EXPIRES_IN) || 3600, // 1 hora
      });
      
      const refreshToken = this.jwtService.sign(
        { ...payload, isRefreshToken: true },
        { expiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN) || 604800 }, // 7 días
      );

      // Guardar refresh token en la base de datos
      try {
        await this.prisma.verification_token.create({
          data: {
            token: refreshToken,
            token_type: 'refresh_token',
            user_id: user.user_id,
            used: false,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
            attempts: 0,
          },
        });

        // Limpiar tokens de refresh antiguos (mantener solo los 2 más recientes)
        const oldTokens = await this.prisma.verification_token.findMany({
          where: {
            user_id: user.user_id,
            token_type: 'refresh_token',
            used: false,
            expires_at: { gt: new Date() },
          },
          orderBy: { created_at: 'desc' },
          skip: 2,
        });

        if (oldTokens.length > 0) {
          await this.prisma.verification_token.updateMany({
            where: {
              verification_token_id: { in: oldTokens.map(t => t.verification_token_id) },
            },
            data: { used: true, used_at: new Date() },
          });
        }
      } catch (tokenError) {
        //console.error('Error gestionando tokens:', tokenError);
        // No lanzamos error aquí para no romper el login
      }

      // Retornar resultado exitoso
      const result: LoginResult = {
        message: 'Login exitoso',
        accessToken,
        refreshToken,
        user_id: Number(user.user_id),
        user: {
          user_id: Number(user.user_id),
          email: user.email,
          type_user_id: user.type_user_id ? Number(user.type_user_id) : null,
          type_user_name: user.type_user?.name_type || null,
        },
      };
      
      return result;

    } catch (error) {
      // Manejo específico de errores
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case 'P1001':
            throw new ServiceUnavailableException(
              'No se puede conectar al servidor de base de datos. Intenta nuevamente en unos momentos.'
            );
          case 'P1017':
            throw new ServiceUnavailableException(
              'Conexión a la base de datos cerrada. Intenta nuevamente.'
            );
          default:
            //console.error('Error de Prisma en login:', error);
            throw new InternalServerErrorException('Error en el servidor de datos');
        }
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        throw new ServiceUnavailableException(
          'Error de inicialización de la base de datos. Contacta al administrador.'
        );
      }

      if (error instanceof Prisma.PrismaClientUnknownRequestError) {
        //console.error('Error desconocido de Prisma en login:', error);
        throw new InternalServerErrorException('Error inesperado en el servidor');
      }

      // Manejar timeout personalizado
      if (error.message === 'DATABASE_TIMEOUT') {
        throw new ServiceUnavailableException(
          'El servidor está tardando demasiado en responder. Intenta nuevamente.'
        );
      }

      // Error genérico
      //console.error('Error inesperado en login:', error);
      throw new InternalServerErrorException('Error al iniciar sesión');
    }
  }

  async verifyCode(dto: VerifyCodeDto) {
    const email = dto.email?.toLowerCase().trim();
    const code = String(dto.code || '').trim();
    const tokenType = dto.token_type;

    /* console.log('🔐 [DEBUG] Verificación solicitada:', { 
      email, 
      code, 
      tokenType,
      timestamp: new Date().toISOString()
    }); */

    if (!email || !/^\d{6}$/.test(code)) {
      //console.log('❌ [DEBUG] Email o código inválido');
      throw new UnauthorizedException('Código de verificación inválido o expirado');
    }

    const user = await this.prisma.users.findUnique({ 
      where: { email },
      select: { user_id: true, status: true, email: true }
    });
    
    if (!user) {
      //console.log('❌ [DEBUG] Usuario no encontrado:', email);
      throw new UnauthorizedException('Código de verificación inválido o expirado');
    }

    /* console.log('🔍 [DEBUG] Usuario encontrado:', {
      user_id: Number(user.user_id),
      status: user.status,
      email: user.email
    }); */

    // ✅ CORREGIDO: Validar y asegurar el tipo de tokenType
    const validTokenType = tokenType === 'reset_password' 
      ? 'reset_password' 
      : 'email_verification';

    // ✅ Buscar token con el tipo correcto y que no esté expirado
    const token = await this.prisma.verification_token.findFirst({
      where: {
        user_id: user.user_id,
        token: code,
        token_type: validTokenType,
        used: false,
        expires_at: { 
          gt: new Date()
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!token) {
      //console.log('❌ [DEBUG] Token no encontrado');
      await this.incrementVerificationAttemptsByType(user.user_id, validTokenType);
      throw new UnauthorizedException('Código inválido o expirado. Solicita un nuevo código.');
    }

    /* console.log('✅ [DEBUG] Token válido encontrado:', {
      id: Number(token.verification_token_id),
      type: token.token_type,
      expires: token.expires_at,
      time_until_expiry: token.expires_at ? 
        Math.round((token.expires_at.getTime() - Date.now()) / 1000) + ' segundos' : 'N/A',
      attempts: token.attempts,
      created_at: token.created_at
    }); */

    // ✅ Verificar intentos
    if ((token.attempts ?? 0) >= MAX_ATTEMPTS) {
      //console.log('❌ [DEBUG] Demasiados intentos:', token.attempts);
      throw new UnauthorizedException('Demasiados intentos. Solicita un nuevo código.');
    }

    // ✅ Manejar diferentes tipos de token
    if (validTokenType === 'email_verification') {
      //console.log('✅ [DEBUG] Activando cuenta de usuario:', Number(user.user_id));
      
      try {
        await this.prisma.$transaction(async (tx) => {
          // Activar usuario
          await tx.users.update({
            where: { user_id: user.user_id },
            data: { status: 'active' },
          });

          // ✅ Marcar token como usado SOLO para email_verification
          await tx.verification_token.update({
            where: { verification_token_id: token.verification_token_id },
            data: { 
              used: true, 
              used_at: new Date(),
              attempts: (token.attempts ?? 0) + 1
            },
          });

          // Invalidar otros tokens de verificación pendientes
          await tx.verification_token.updateMany({
            where: {
              user_id: user.user_id,
              token_type: 'email_verification',
              used: false,
              verification_token_id: { not: token.verification_token_id },
            },
            data: { used: true },
          });
        });

        //console.log('🎉 [DEBUG] Usuario activado exitosamente');

        return { 
          message: 'Usuario verificado exitosamente', 
          user_id: Number(user.user_id),
          verified: true 
        };
      } catch (transactionError) {
        //console.error('❌ [DEBUG] Error en transacción:', transactionError);
        throw new InternalServerErrorException('Error al activar la cuenta');
      }
    }

    // Para reset_password, SOLO validar que existe pero NO marcarlo como usado
    if (validTokenType === 'reset_password') {
      //console.log('✅ [DEBUG] Código de reset válido para usuario:', Number(user.user_id));
      
      // ✅ CORREGIDO: NO marcar el token como usado aquí
      // Solo incrementar el contador de intentos para tracking
      await this.prisma.verification_token.update({
        where: { verification_token_id: token.verification_token_id },
        data: { 
          attempts: (token.attempts ?? 0) + 1 // Solo registrar el intento
          // NO marcamos used: true aquí - eso se hará en resetPassword
        },
      });

      return { 
        ok: true, 
        message: 'Código válido para restablecer contraseña',
        valid: true,
        user_id: Number(user.user_id)
      };
    }

    //console.log('❌ [DEBUG] Tipo de token no soportado:', validTokenType);
    throw new UnauthorizedException('Tipo de verificación no soportado');
  }

  // En tu AuthService, agrega este método después del método verifyCode:

  async resendCode(dto: ResendCodeDto) {
    const email = dto.email?.toLowerCase().trim();
    if (!email) throw new BadRequestException('Email requerido');

    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) {
      // Por seguridad, no revelar si el usuario existe o no
      return { message: 'Código de verificación reenviado exitosamente' };
    }

    // Verificar cooldown
    const recent = await this.prisma.verification_token.findFirst({
      where: {
        user_id: user.user_id,
        token_type: 'email_verification',
        created_at: { gte: new Date(Date.now() - RESEND_COOLDOWN_MS) },
        used: false,
      },
      orderBy: { created_at: 'desc' },
    });
    
    if (recent) {
      throw new HttpException('Espera unos segundos antes de pedir otro código.', 429);
    }

    // Invalidar tokens anteriores
    await this.prisma.verification_token.updateMany({
      where: { 
        user_id: user.user_id, 
        token_type: 'email_verification', 
        used: false 
      },
      data: { used: true },
    });

    // Generar nuevo código
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

    await this.prisma.verification_token.create({
      data: {
        token: verificationCode,
        token_type: 'email_verification',
        user_id: user.user_id,
        used: false,
        attempts: 0,
        expires_at: expiresAt,
      },
    });

    // Enviar email
    try {
      await this.emailService.sendVerificationCode(user.email, verificationCode);
    } catch (mailErr) {
      //console.error('[EmailService] Error enviando verificación:', mailErr);
      throw new InternalServerErrorException('Error al enviar el código de verificación');
    }

    return { message: 'Código de verificación reenviado exitosamente' };
  }

  private async incrementVerificationAttempts(userId: bigint) {
  try {
    const latestToken = await this.prisma.verification_token.findFirst({
      where: {
        user_id: userId,
        token_type: 'email_verification',
        used: false,
        created_at: { gte: new Date(Date.now() - VERIFICATION_TTL_MS) },
      },
      orderBy: { created_at: 'desc' },
    });
    if (latestToken) {
      await this.prisma.verification_token.update({
        where: { verification_token_id: latestToken.verification_token_id },
        data: { attempts: { increment: 1 } },
      });
    }
  } catch (e) {
    //console.error('Error incrementando intentos:', e);
  }
}

// ✅ AGREGAR ESTE MÉTODO NUEVO
private async incrementVerificationAttemptsByType(
  userId: bigint, 
  tokenType: 'email_verification' | 'reset_password'
) {
  try {
    const latestToken = await this.prisma.verification_token.findFirst({
      where: {
        user_id: userId,
        token_type: tokenType, // ✅ Usar el tipo específico
        used: false,
        created_at: { gte: new Date(Date.now() - VERIFICATION_TTL_MS) },
      },
      orderBy: { created_at: 'desc' },
    });
    
    if (latestToken) {
      await this.prisma.verification_token.update({
        where: { verification_token_id: latestToken.verification_token_id },
        data: { attempts: { increment: 1 } },
      });
      //console.log(`📈 Intentos incrementados para token tipo: ${tokenType}`);
    }
  } catch (e) {
    //console.error('Error incrementando intentos por tipo:', e);
  }
}

  async refreshToken(refreshToken: string) {
    try {
      const tokenRecord = await this.prisma.verification_token.findFirst({
        where: { token: refreshToken, token_type: 'refresh_token', used: false, expires_at: { gt: new Date() } },
        include: { users: true },
      });
      if (!tokenRecord || !tokenRecord.users) {
        throw new UnauthorizedException('Token de refresco inválido');
      }

      await this.prisma.verification_token.update({
        where: { verification_token_id: tokenRecord.verification_token_id },
        data: { used: true, used_at: new Date() },
      });

      const payload = { userId: Number(tokenRecord.users.user_id), email: tokenRecord.users.email };
      const newAccessToken = this.jwtService.sign(payload, {
        expiresIn: Number(process.env.JWT_ACCESS_EXPIRES_IN) || 3600,
      });
      const newRefreshToken = this.jwtService.sign(
      { ...payload, isRefreshToken: true },
      { expiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN) || 604800 },
      );

      await this.prisma.verification_token.create({
        data: {
          token: newRefreshToken,
          token_type: 'refresh_token',
          user_id: tokenRecord.user_id,
          used: false,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          attempts: 0,
        },
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      //console.error('Error refrescando token:', error);
      throw new InternalServerErrorException('Error al refrescar el token');
    }
  }

  async getProfile(userId: number) {
    try {
      const user = await this.prisma.users.findUnique({
        where: { user_id: BigInt(userId) },
        include: {
          type_user: { select: { name_type: true, descript: true } },
        },
      });
      if (!user) throw new NotFoundException('Usuario no encontrado');

      const { password_user, ...profile } = user;
      return {
        ...profile,
        user_id: Number(profile.user_id),
        kit_id: profile.kit_id ? Number(profile.kit_id) : null,
        workshop_id: profile.workshop_id ? Number(profile.workshop_id) : null,
        type_user_id: profile.type_user_id ? Number(profile.type_user_id) : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      //console.error('Error obteniendo perfil:', error);
      throw new InternalServerErrorException('Error al obtener el perfil');
    }
  }

  async logoutByRefreshToken(refreshToken: string) {
    await this.prisma.verification_token.updateMany({
      where: { token: refreshToken, token_type: 'refresh_token', used: false },
      data: { used: true, used_at: new Date() },
    });
  }
}

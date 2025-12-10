// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/auth/validation/guards/jwt.guard';
import { AuthService } from '@auth/auth.service';
import type { LoginResult } from '@auth/auth.service';
import { CreateUserDto } from '@auth/dto/create-user.dto';
import { CreateLoginDto } from '@auth/dto/create-login.dto';
import { VerifyCodeDto } from '@auth/dto/verify-code.dto';
import { ResendCodeDto } from '@auth/dto/resend-code.dto';
import { ForgotPasswordDto } from '@auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@auth/dto/reset-password.dto';
import { Request, Response } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
  };
}

@ApiTags('Auth')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Helper local para opciones de cookie por entorno (sin crear archivo nuevo)
  private cookieBase() {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      path: '/',
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      domain: isProd ? '.congresoti.com.mx' : undefined,
    } as const;
  }

  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado correctamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @ApiResponse({ status: 409, description: 'Usuario ya registrado' })
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('register')
  async register(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // El servicio puede setear la cookie 'verify' si aplica
    return this.authService.createUser(createUserDto, res);
  }

  @ApiOperation({ summary: 'Verificar contraseña secreta para registro de ponentes' })
  @ApiResponse({ status: 200, description: 'Contraseña de ponente válida' })
  @ApiResponse({ status: 401, description: 'Contraseña de ponente inválida' })
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('speakers/check-secret')
  checkSpeakerSecret(@Body() body: { secret_password: string }) {
    const secret = (process.env.SPEAKER_SECRET || '').trim();
    if (!secret || (body.secret_password || '').trim() !== secret) {
      throw new UnauthorizedException('Contraseña de ponente inválida');
    }
    return { ok: true };
  }

  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  @ApiResponse({ status: 200, description: 'Código enviado al correo si existe' })
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    try {
      return await this.authService.forgotPassword(forgotPasswordDto);
    } catch (error) {
      //console.error('Forgot password error:', error);
      
      // Para errores de validación, mantener el mensaje
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Para otros errores, usar mensaje genérico
      throw new InternalServerErrorException('Error al procesar la solicitud');
    }
  }

  @ApiOperation({ summary: 'Restablecer contraseña' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada correctamente' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña' })
  @ApiResponse({ status: 200, description: 'Inicio de sesión exitoso o verificación requerida' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: CreateLoginDto, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.authService.loginUser(loginDto);

      // ✅ Asegurar que se devuelva el resultado de verificación requerida
      if ('require_verification' in result && result.require_verification) {
        return result; // Esto incluye el mensaje y datos del usuario no verificado
      }

      // Login exitoso - configurar cookies
      const loginSuccess = result as Extract<LoginResult, { accessToken: string }>;
      const { accessToken, refreshToken, user_id, message, user } = loginSuccess;

      const base = this.cookieBase();
      
      res.cookie('access_token', accessToken, { 
        ...base, 
        maxAge: 15 * 60 * 1000
      });
      res.cookie('refresh_token', refreshToken, { 
        ...base, 
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return {
        message,
        user_id,
        access_token: accessToken,
        refresh_token: refreshToken,
        user,
      };
    } catch (error) {
      // ✅ Mejor manejo de errores específicos
      if (error instanceof UnauthorizedException) {
        // Mantener mensajes específicos como "Cuenta no verificada"
        throw error;
      }
      
      //console.error('Login controller error:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }

  @ApiOperation({ summary: 'Verificar cuenta con código enviado por correo' })
  @ApiResponse({ status: 200, description: 'Cuenta verificada exitosamente' })
  @ApiResponse({ status: 400, description: 'Código inválido o expirado' })
  @Throttle({ default: { limit: 5, ttl: 60 * 5 } })
  @Post('verify')
  async verifyCode(@Body() verifyCodeDto: VerifyCodeDto) {
    //console.log('Verification request:', verifyCodeDto); // Debug
    try {
      const result = await this.authService.verifyCode(verifyCodeDto);
      //console.log('Verification result:', result); // Debug
      return result;
    } catch (error) {
      //console.error('Verification error:', error); // Debug
      throw error;
    }
  }

  @ApiOperation({ summary: 'Reenviar código de verificación al correo electrónico' })
  @ApiResponse({ status: 200, description: 'Código reenviado correctamente' })
  @Throttle({ default: { limit: 2, ttl: 60 * 60 } })
  @Post('resend-code')
  async resendCode(@Body() resendCodeDto: ResendCodeDto) {
    return this.authService.resendCode(resendCodeDto);
  }

  @ApiOperation({ summary: 'Obtener el perfil del usuario autenticado' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.userId);
  }

  @ApiOperation({ summary: 'Cerrar sesión e invalidar refresh token' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    
    const refreshToken = req.cookies?.['refresh_token'] ?? null;

    if (refreshToken) {
      try {
        await this.authService.logoutByRefreshToken(refreshToken);
      } catch (e) {
        //console.warn('No se pudo revocar refresh token:', e);
      }
    }

    const base = this.cookieBase();
    
    // Limpiar cookies de manera más agresiva
    res.clearCookie('access_token', base);
    res.clearCookie('refresh_token', base);
    
    // También limpiar la cookie de verify por si acaso
    res.clearCookie('verify', { 
      path: '/',
      domain: base.domain 
    });

    return { message: 'Sesión cerrada correctamente' };
  }

  @ApiOperation({ summary: 'Obtener nuevo token de acceso con refresh token' })
  @ApiResponse({ status: 200, description: 'Token actualizado correctamente' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  @Post('refresh')
  async refreshToken(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshToken(refreshToken);

    const base = this.cookieBase();

    res.cookie('access_token', accessToken, {
      ...base,
      maxAge: 1000 * 60 * 15,
    });
    res.cookie('refresh_token', newRefreshToken, {
      ...base,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return { message: 'Token refrescado correctamente' };
  }
}
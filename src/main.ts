// src/main.ts - VERSIÓN COMPLETA Y CORREGIDA
import 'dotenv/config';
import 'tsconfig-paths/register';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { Logger, ValidationPipe, BadRequestException } from '@nestjs/common';
import { envs } from '@/config/envs';
import { HttpExceptionFilter } from './game/scores/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    cors: {
      origin: [
        'https://congresoti.com.mx',
        'https://www.congresoti.com.mx',
        'http://localhost:3000',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'x-skip-refresh',
        'stripe-signature',
        'Idempotency-Key',
      ],
      exposedHeaders: ['Set-Cookie', 'Authorization'],
    },
  });

  // Webhook de Stripe: necesita el raw body, NO JSON parseado antes
  app.use(
    '/payment-stripe/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

  // Body parser normal para el resto de rutas
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

  // Trust proxy (útil si estás detrás de Nginx / Cloudflare en producción)
  if (process.env.NODE_ENV === 'production') {
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance?.();
    if (instance?.set) {
      instance.set('trust proxy', 1);
    }
  }

  // Cookies (para JWT HttpOnly)
  app.use(cookieParser());

  // ❗ IMPORTANTE:
  // NO hay middlewares CORS manuales extra.
  // Todo el CORS se maneja con la opción `cors` de NestFactory.create.

  // Validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const formatted = errors.map((e) => ({
          property: e.property,
          constraints: e.constraints,
        }));
        return new BadRequestException({
          errors: formatted,
          message: 'Datos inválidos',
        });
      },
    }),
  );

  // Filtro global para formatear excepciones HTTP
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger / documentación
  const swaggerConfig = new DocumentBuilder()
    .setTitle('3er Congreso Internacional TI - API')
    .setDescription(
      'API para el 3er Congreso Internacional de Tecnologías de la Información',
    )
    .setVersion('1.0')
    .addTag('auth', 'Autenticación y autorización')
    .addTag('users', 'Gestión de usuarios')
    .addTag('scores', 'Puntajes del juego')
    .addTag('payments', 'Sistema de pagos')
    .addTag('stripe', 'Integración con Stripe')
    .addTag('workshops', 'Gestión de talleres')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese el token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .addCookieAuth(
      'access_token',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
        description: 'Cookie de autenticación JWT',
      },
      'cookie-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
    customSiteTitle: 'API - 3er Congreso TI',
  });

  // Iniciar servidor
  const port = envs.port || 3001;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Servidor ejecutándose en: http://localhost:${port}`);
  logger.log('🌐 CORS configurado correctamente');
  logger.log('🔐 Autenticación: JWT + Cookies HttpOnly');
  logger.log(`📚 Documentación API: http://localhost:${port}/api`);
  logger.log(`⚙️ Entorno: ${process.env.NODE_ENV || 'development'}`);
}

// GLOBAL ERROR HANDLING
process.on('unhandledRejection', (reason, promise) => {
  const logger = new Logger('UnhandledRejection');
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  const logger = new Logger('UncaughtException');
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Error durante el bootstrap:', error);
  process.exit(1);
});

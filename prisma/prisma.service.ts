// src/prisma/prisma.service.ts
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  INestApplication,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: { db: { url: process.env.DATABASE_URL } },
      log: [
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ],
      errorFormat: 'colorless',
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected ✅');
  }

  async enableShutdownHooks(app: INestApplication) {
    const shutdown = async (signal: string) => {
      this.logger.log(`Received ${signal}. Closing app…`);
      try { await this.$disconnect(); } catch {}
      await app.close();
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('beforeExit', async () => {
      this.logger.log('process beforeExit → closing Prisma and app…');
      try { await this.$disconnect(); } catch {}
      await app.close();
    });
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    const maxAttempts = 5;
    const delayMs = Math.min(5000 * attempt, 20000);

    this.logSafeTarget();

    try {
      await this.$connect();
      await this.$queryRawUnsafe('SELECT 1');
      this.logger.log('Prisma connected ✅');
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientInitializationError && attempt < maxAttempts) {
        this.logger.warn(
          `Prisma init/connect failed (attempt ${attempt}/${maxAttempts}) → ${e.errorCode ?? 'unknown'}: ${e.message}`,
        );
        await new Promise(r => setTimeout(r, delayMs));
        return this.connectWithRetry(attempt + 1);
      }
      this.logger.error(`Prisma failed to connect ❌ ${e?.message ?? e}`);
      throw e;
    }
  }

  private logSafeTarget() {
    const raw = process.env.DATABASE_URL || '';
    try {
      const u = new URL(raw);
      const host = u.hostname;
      const port = u.port || '(default)';
      const db = u.pathname?.replace('/', '') || '(no-db)';
      this.logger.log(`Connecting to DB → ${host}:${port} / ${db}`);
    } catch {
      this.logger.warn('DATABASE_URL no es una URL válida. Revisa tu .env');
    }
  }
}
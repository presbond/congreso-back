import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '@prisma/prisma.service';
import { EmailService } from './validation/email/email.service';
import { JwtStrategy } from './validation/strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultSecret',
      signOptions: { expiresIn: '1h' },
    }),
    CacheModule.register({
      isGlobal: true, // ✅ para que funcione en todo el proyecto sin necesidad de importarlo en cada módulo
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, EmailService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}

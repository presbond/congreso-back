import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';
import { ScheduleModule } from '@/schedule/schedule.module';
import { PrismaModule } from '@prisma/prisma.module';
import { ScoresModule } from './game/scores/scores.module';
import { PaymentStripeModule } from './payment-stripe/payment-stripe.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from '@/admin/admin.module';
import { WorkshopModule } from './workshop/workshop.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000, // ttl en milisegundos, 60 segundos
      limit: 10,
    }]),
    AuthModule,
    PrismaModule,
    UserModule, 
    ScheduleModule, 
    PaymentStripeModule,
    ScoresModule,
    AdminModule,
    WorkshopModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
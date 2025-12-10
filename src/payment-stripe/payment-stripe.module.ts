import { Module } from '@nestjs/common';
import { PaymentStripeService } from './service/payment-stripe.service';
import { PaymentStripeController } from './controller/payment-stripe.controller';
import { PaymentConfigModule } from '../config/payment.config';

@Module({
  imports: [PaymentConfigModule],
  controllers: [PaymentStripeController],
  providers: [PaymentStripeService],
  exports: [PaymentStripeService],
})
export class PaymentStripeModule {}

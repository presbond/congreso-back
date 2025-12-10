import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStripeController } from './payment-stripe.controller';

describe('PaymentStripeController', () => {
  let controller: PaymentStripeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentStripeController],
    }).compile();

    controller = module.get<PaymentStripeController>(PaymentStripeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

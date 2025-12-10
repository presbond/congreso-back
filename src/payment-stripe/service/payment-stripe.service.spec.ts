import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStripeServiceService } from './payment-stripe.service';

describe('PaymentStripeServiceService', () => {
  let service: PaymentStripeServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentStripeServiceService],
    }).compile();

    service = module.get<PaymentStripeServiceService>(PaymentStripeServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

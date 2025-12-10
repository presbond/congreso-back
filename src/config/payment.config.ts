import { Global, Module } from '@nestjs/common';

export type PaymentConfig = {
    paymentMarket: {
        accessToken: string;
    };
    stripe: {
        secretKey: string | undefined;
        publicKey: string | undefined;
        webhookSecret: string | undefined;
        appDomain: string; // <- importante
        priceCongreso: string | undefined;
        pricePaquetes: string | undefined;
        priceSouvenirs: string | undefined;
    };
};

export class PaymentConfigService {
    readonly paymentMarket = {
        accessToken: process.env.PAYMENT_MARKET_ACCESS_TOKEN || '',
    };

    readonly stripe = {
        secretKey: process.env.STRIPE_SECRET_KEY,
        publicKey: process.env.STRIPE_PUBLIC_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        appDomain: process.env.APP_DOMAIN || 'http://localhost:3000', // <- aquí
        priceCongreso: process.env.PRICE_CONGRESO,
        pricePaquetes: process.env.PRICE_PAQUETES,
        priceSouvenirs: process.env.PRICE_SOUVENIRS,
    } as const;
}


@Global()
@Module({
    providers: [
        {
            provide: PaymentConfigService,
            useFactory: () => new PaymentConfigService(),
        },
    ],
    exports: [PaymentConfigService],
})
export class PaymentConfigModule { }

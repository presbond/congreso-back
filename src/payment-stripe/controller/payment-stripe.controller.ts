// src/payment-stripe/controller/payment-stripe.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus, Param, Req, Headers, UseGuards, Get, UnauthorizedException } from '@nestjs/common';
import { PaymentStripeService } from '../service/payment-stripe.service';
import { CreateCheckoutSessionDto } from '../dto/stripe-payment-create-body.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CheckoutSessionResponseDto } from '../dto/checkout-session-response.dto';
import { VerifyPaymentResponseDto } from '../dto/verify-payment-response.dto';
import { StripeErrorDto } from '../dto/stripe-error.dto';
import Stripe from 'stripe';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('stripe')
@Controller('payment-stripe')
export class PaymentStripeController {
    logger: any;
    constructor(private readonly paymentStripeService: PaymentStripeService) { }
    @UseGuards(AuthGuard('jwt'))
    @Post('create-checkout-session')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Crear una sesión de pago de Stripe',
        description: 'Crea una nueva sesión de pago utilizando Stripe Checkout'
    })
    @ApiBody({
        type: CreateCheckoutSessionDto,
        description: 'Datos para crear la sesión de pago'
    })
    @ApiResponse({
        status: 200,
        description: 'Sesión creada exitosamente',
        type: CheckoutSessionResponseDto
    })
    @ApiResponse({
        status: 400,
        description: 'Datos inválidos o error en la configuración de Stripe',
        type: StripeErrorDto
    })
    @ApiResponse({
        status: 500,
        description: 'Error interno del servidor',
        type: StripeErrorDto
    })
    async createCheckoutSession(
        @Body() createCheckoutSessionDto: CreateCheckoutSessionDto,
        @Req() req,
    ) {
        const userId = req.user?.userId; // Usuario autenticado desde cookie/JWT


        // Validar que el usuario esté autenticado
        if (!userId) {
            console.log('❌ Usuario no autenticado - userId no encontrado');
            throw new UnauthorizedException('Usuario no autenticado');
        }

        // Crear el DTO modificado con el userId como clientReferenceId
        const sessionData = {
            ...createCheckoutSessionDto,
            clientReferenceId: String(userId), // 👈 Usar userId
            metadata: {
                ...(createCheckoutSessionDto.metadata || {}),
                userId: String(userId),
            }
        };

        console.log('🔐 SessionData a enviar al service:', sessionData);

        // 👇 Pasar el userId al service (convertido a BigInt)
        return await this.paymentStripeService.createEmbeddedCheckoutSession(
            sessionData,
            BigInt(userId)
        );
    }

    @Get('verify-payment/:sessionId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Verificar estado de un pago',
        description: 'Verifica si un pago se ha completado correctamente usando el ID de sesión'
    })
    @ApiResponse({
        status: 200,
        description: 'Estado del pago verificado',
        type: VerifyPaymentResponseDto
    })
    @ApiResponse({
        status: 400,
        description: 'ID de sesión inválido o error al verificar el pago',
        type: StripeErrorDto
    })
    @ApiResponse({
        status: 500,
        description: 'Error interno del servidor',
        type: StripeErrorDto
    })
    async verifyPayment(@Param('sessionId') sessionId: string) {
        return await this.paymentStripeService.verifyCheckoutSessionPayment(sessionId);
    }

    @SkipThrottle() // 👈 evita rate limit aquí
    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    async webhook(@Req() req: any, @Headers() headers: Record<string, string>) {
        console.log('[webhook] 🔔 Evento recibido', new Date().toISOString());
        // Logs de diagnóstico
        console.log('[webhook] hit', new Date().toISOString());
        console.log('[webhook] content-type:', headers['content-type']);
        // header case-insensitive
        const sig = headers['stripe-signature'] || headers['Stripe-Signature'];
        if (!sig) {
            console.error('[webhook] missing stripe-signature header');
            return { received: true }; // responde 200 para evitar reintentos infinitos
        }

        try {
            const secret = this.paymentStripeService.getWebhookSecret();
            // bodyParser.raw() deja el body en req.body (Buffer). Nest rawBody también existe.
            const payload = req.rawBody || req.body;

            console.log('[webhook] 📦 Payload tipo:', typeof payload);
            console.log('[webhook] 📦 Payload length:', payload?.length);

            const event = this.paymentStripeService.constructEventFromPayload(payload, sig, secret);

            
            console.log('[webhook] event.type:', event.type, 'id:', event.id, 'livemode:', (event as any).livemode);

            if (event.type === 'checkout.session.completed') {
                const session = event.data.object as Stripe.Checkout.Session;
                await this.paymentStripeService.markPaidFromSession(session);
            }

            return { received: true };
        } catch (err: any) {
            console.error('[webhook] constructEvent error:', err?.message);
            // Importante: Stripe reintenta si devuelves 4xx/5xx
            return { received: true };
        }
    }
}

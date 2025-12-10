// src/payment-stripe/service/payment-stripe.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { PaymentConfigService } from '../../config/payment.config';
import { CreateCheckoutSessionDto } from '../dto/stripe-payment-create-body.dto';
import { VerifyPaymentResponseDto } from '../dto/verify-payment-response.dto';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class PaymentStripeService {
  private readonly logger = new Logger(PaymentStripeService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly paymentConfigService: PaymentConfigService,
    private readonly prisma: PrismaService,
  ) {
    const sk = this.paymentConfigService.stripe.secretKey;
    if (!sk) {
      throw new Error('STRIPE_SECRET_KEY no está configurada');
    }
    this.stripe = new Stripe(sk, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    });
  }


  /** Mapea Checkout.Session -> campos de tu tabla Payment */
  private mapSessionToBase(session: Stripe.Checkout.Session) {
    return {
      sessionId: session.id,
      status: (session.status ?? 'open') as string,
      paymentStatus: (session.payment_status ?? 'unpaid') as string,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? 'mxn',
      customerId: (session.customer as string) ?? null,
      customerEmail: session.customer_email ?? null,
      mode: (session.mode ?? 'payment') as string,
      clientReferenceId: session.client_reference_id ?? null,
      metadata: (session.metadata ?? {}) as Prisma.InputJsonValue,
    };
  }



  private async savePendingSession(session: Stripe.Checkout.Session, userId?: bigint) {
    const base = this.mapSessionToBase(session);

    const createData: Prisma.PaymentCreateInput = {
      id: randomUUID(),                 // <-- requerido por tu schema
      ...base,
      updatedAt: new Date(),            // <-- requerido por tu schema
      ...(userId ? { users: { connect: { user_id: userId } } } : {}),
    };
    const updateData: Prisma.PaymentUpdateInput = {
      status: base.status,
      paymentStatus: base.paymentStatus,
      amountTotal: base.amountTotal,
      currency: base.currency,
      customerId: base.customerId,
      customerEmail: base.customerEmail,
      mode: base.mode,
      clientReferenceId: base.clientReferenceId,
      metadata: base.metadata,
      updatedAt: new Date(),            // <-- requerido por tu schema
      ...(userId ? { users: { connect: { user_id: userId } } } : {}),
    };

    await this.prisma.payment.upsert({
      where: { sessionId: session.id },
      create: createData,
      update: updateData,
    });
  }

  // 👇 REEMPLAZA TU FUNCIÓN ACTUAL CON ESTA
  async markPaidFromSession(session: Stripe.Checkout.Session) {
    this.logger.log(`[markPaid] 🎯 Iniciando actualización para sesión: ${session.id}`);

    if (!session) {
      throw new BadRequestException('sessionId requerido');
    }
    if (session.payment_status !== 'paid') {
      this.logger.warn(
        `[markPaid] ❌ Sesión NO está pagada. Status: ${session.payment_status}`,
      );
      return; // No es un error, solo no está pagada
    }

    // 1. Extraer ID de usuario (¡CLAVE!)
    const userId = session.client_reference_id
      ? BigInt(session.client_reference_id)
      : undefined;
    this.logger.log(`[markPaid] 👤 UserId extraído: ${userId}`);

    // 2. Preparar datos del pago
    const pi = session.payment_intent as Stripe.PaymentIntent | null;
    const latestCharge = (pi?.latest_charge as Stripe.Charge) || null;

    const paymentData = {
      status: session.status ?? 'complete',
      paymentStatus: session.payment_status ?? 'paid',
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? 'mxn',
      customerId: (session.customer as string) ?? null,
      customerEmail: session.customer_email ?? null,
      mode: session.mode ?? 'payment',
      clientReferenceId: session.client_reference_id ?? null,
      metadata: (session.metadata ?? {}) as Prisma.InputJsonValue,
      paymentIntentId: pi?.id ?? null,
      paymentIntentStatus: pi?.status ?? null,
      chargeId: latestCharge?.id ?? null,
      receiptUrl: latestCharge?.receipt_url ?? null,
      paymentMethodType: latestCharge?.payment_method_details?.type ?? null,
      updatedAt: new Date(),
      ...(userId ? { users: { connect: { user_id: userId } } } : {}),
    };

    // 3. Preparar las operaciones de la transacción
    const operations: any[] = [];

    // Operación 1: Crear o actualizar el registro de Pago
    operations.push(
      this.prisma.payment.upsert({
        where: { sessionId: session.id },
        create: {
          id: randomUUID(),
          sessionId: session.id,
          ...paymentData,
        },
        update: paymentData,
      }),
    );

    // Operación 2: Activar al usuario (EL PASO QUE FALTABA)
    if (userId) {
      this.logger.log(`[markPaid] 🚀 Preparando activación para usuario: ${userId}`);
      operations.push(
        this.prisma.users.update({
          where: { user_id: userId },
          data: {
            // Tu schema indica que 'status_event' es el campo booleano
            status_event: true,

            // Opcional: Si también quieres cambiar el 'status' (enum)
            // status: 'active',
          },
        }),
      );
    } else {
      this.logger.warn(
        `[markPaid] ⚠️ No se encontró userId en la sesión ${session.id}. No se puede activar usuario.`,
      );
    }

    // 4. Ejecutar como transacción
    try {
      const [paymentResult, userResult] = await this.prisma.$transaction(
        operations,
      );
      this.logger.log(
        `[markPaid] ✅ Transacción completada. Pago: ${paymentResult.id}`,
      );
      if (userResult) {
        this.logger.log(`[markPaid] ✅ Usuario ${userResult.user_id} activado.`);
      }
    } catch (error) {
      this.logger.error(`[markPaid] ‼️ Error en la transacción del webhook:`, error);
      // No relanzamos el error para evitar reintentos de Stripe
      // si el error es, por ejemplo, que el usuario no existe.
    }
  }

  //revisar en extractUserIdFromBody  
  private extractUserIdFromBody(body: any): bigint | undefined {
    // Primero intenta desde client_reference_id (lo más confiable)
    const raw = body?.clientReferenceId || body?.client_reference_id || body?.metadata?.userId;

    if (raw === undefined || raw === null) return undefined;

    try {
      return BigInt(raw);
    } catch {
      this.logger.warn(`No se pudo convertir a BigInt: ${raw}`);
      return undefined;
    }
  }

  // CORREGIDO - método actualizado
  async createEmbeddedCheckoutSession(
    body: CreateCheckoutSessionDto,
    userId?: bigint,//parametro añadido 
  ): Promise<{ sessionId: string; clientSecret: string | null }> {
    try {
      if (!Array.isArray(body.items) || body.items.length === 0) {
        throw new BadRequestException('items requerido y no puede estar vacío');
      }

      // Extraer userId del body si no se pasó como parámetro
      const finalUserId = userId || (body.clientReferenceId ? BigInt(body.clientReferenceId) : undefined);

      // VALIDAR que clientReferenceId esté presente (viene del controller)
      if (!finalUserId) {
        throw new BadRequestException('Se requiere usuario autenticado para crear sesión de pago');
      }

      const lineItems = body.items.map((item) => {
        const priceId = this.getPriceId(item.price);
        if (!priceId) throw new BadRequestException(`Precio no definido: ${item.price}`);
        if (!item.quantity || item.quantity < 1) {
          throw new BadRequestException('quantity debe ser >= 1');
        }
        return { price: priceId, quantity: item.quantity };
      });

      const returnUrl =
        `${this.paymentConfigService.stripe.appDomain}/stripe/success?session_id={CHECKOUT_SESSION_ID}`;

      // CREAR SESIÓN EN STRIPE - asegurando que client_reference_id se pase
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        ui_mode: 'embedded',
        line_items: lineItems,
        return_url: returnUrl,
        customer_email: body.customerEmail,
        client_reference_id: String(finalUserId), // 👈 ESTO ES CLAVE
        metadata: {
          ...(body.metadata || {}),
          userId: String(finalUserId), // 👈 Backup en metadata
        },
      });

      await this.savePendingSession(session, finalUserId);

      // Extraer userId del clientReferenceId (que viene del controller)

      if (!finalUserId) {
        this.logger.warn('No se pudo extraer userId para asociar el pago');
      }

      return { sessionId: session.id, clientSecret: session.client_secret ?? null };
    } catch (error: any) {
      this.logger.error('Error al crear sesión embedded', error?.stack || error);
      if (error?.type === 'StripeInvalidRequestError') {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(error?.message || 'Error al crear la sesión de Stripe');
    }
  }

  async retrieveSessionExpanded(sessionId: string) {
    return await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge'],
    });
  }

  /**
   * Recupera detalles de la sesión (útil para depurar o pantallas de admin)
   */
  async getCheckoutSessionDetails(sessionId: string) {
    if (!sessionId) throw new BadRequestException('sessionId requerido');
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent.lastest_charge', 'customer'],
      });
    } catch (error: any) {
      this.logger.error('Error al obtener detalles de la sesión', error?.stack || error);
      throw new BadRequestException(error?.message || 'No se pudo recuperar la sesión');
    }
  }

  /**
   * Verifica si una sesión quedó pagada (para la vista /payment/return)
   */
  async verifyCheckoutSessionPayment(sessionId: string): Promise<VerifyPaymentResponseDto> {
    if (!sessionId) throw new BadRequestException('sessionId requerido');
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });

      const paymentStatus = session.payment_status; // 'paid' | 'unpaid' | 'no_payment_required'
      const isComplete = session.status === 'complete' || paymentStatus === 'paid';

      const amount =
        typeof session.amount_total === 'number' ? session.amount_total : 0;
      const pi = session.payment_intent as Stripe.PaymentIntent | null;

      const userId = session.client_reference_id ? BigInt(session.client_reference_id) : undefined;

      return {
        isComplete,
        paymentStatus,
        customerId: (session.customer as string) || null,
        amount,
        currency: session.currency || 'mxn',
        sessionId: session.id,
        userId: userId?.toString(), // 👈 Añadir userId a la respuesta
        clientReferenceId: session.client_reference_id ?? undefined, // 👈 Para debugging
      };
    } catch (error: any) {
      this.logger.error('Error al verificar pago', error?.stack || error);
      throw new BadRequestException(error?.message || 'No se pudo verificar el pago');
    }
  }

  /**
   * Webhook helpers
   */
  getWebhookSecret(): string {
    const ws = this.paymentConfigService.stripe.webhookSecret;
    if (!ws) throw new Error('STRIPE_WEBHOOK_SECRET no está configurado');
    return ws;
  }

  constructEventFromPayload(rawBody: Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  /**
   * Mapeo de alias -> priceId configurados en env
   */
  private getPriceId(code: string): string | null {
    const upper = (code || '').toUpperCase();
    switch (upper) {
      case 'CONGRESO':
        return this.paymentConfigService.stripe.priceCongreso || null;
      case 'PAQUETES':
      case 'PAQUETE':
        return this.paymentConfigService.stripe.pricePaquetes || null;
      case 'SOUVENIRS':
      case 'SOUVENIR':
        return this.paymentConfigService.stripe.priceSouvenirs || null;
      default:
        // también permitimos pasar directamente un price_ de Stripe
        if (upper.startsWith('PRICE_')) return code;
        return null;
    }
  }
}

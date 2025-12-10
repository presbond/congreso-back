// src/payment/stripe/dto/checkout-session.dto.ts
import { IsArray, IsEmail, IsInt, IsOptional, IsPositive, IsString, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LineItemDto {
    /**
     * El ID del precio en Stripe o uno de los valores predefinidos:
     * - 'CONGRESO': Usa el precio configurado en PRICE_CONGRESO
     * - 'PAQUETE': Usa el precio configurado en PRICE_PAQUETES
     * - 'SOUVENIR': Usa el precio configurado en PRICE_SOUVENIRS
     * - O cualquier ID de precio válido de Stripe
     */
    @ApiProperty({
        description: 'ID del precio en Stripe o código predefinido (CONGRESO, PAQUETE, SOUVENIR)',
        example: 'CONGRESO',
        type: String
    })
    @IsString()
    price: string;

    /**
     * Cantidad del item a comprar
     */
    @ApiProperty({
        description: 'Cantidad del producto a comprar',
        example: 1,
        type: Number,
        minimum: 1
    })
    @IsInt()
    @IsPositive()
    quantity: number;
}

export class CreateCheckoutSessionDto {
    @ApiProperty({
        description: 'Lista de productos a comprar',
        type: [LineItemDto],
        isArray: true
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LineItemDto)
    items: LineItemDto[];

    @ApiProperty({ required: false, example: 'https://tu-front.com/payment/return' })
    @IsOptional()
    @IsString()
    returnUrl?: string;

    @ApiProperty({ required: false, example: 'user@example.com' })
    @IsOptional()
    @IsEmail()
    customerEmail?: string;

    @ApiProperty({ required: false, example: 'user_123_order_456' })
    @IsOptional()
    @IsString()
    clientReferenceId?: string;

    @ApiProperty({ required: false, example: { orderId: 'abc123' } })
    @IsOptional()
    metadata?: Record<string, string>;
}
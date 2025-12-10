import { ApiProperty } from '@nestjs/swagger';

export class CheckoutSessionResponseDto {
    @ApiProperty({
        description: 'ID de la sesión de Stripe',
        example: 'cs_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
    })
    sessionId: string;

    @ApiProperty({
        description: 'URL para redirigir al usuario al formulario de pago',
        example: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3...'
    })
    url: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class StripeErrorDto {
    @ApiProperty({
        description: 'Código de error HTTP',
        example: 400
    })
    statusCode: number;

    @ApiProperty({
        description: 'Mensaje de error',
        example: 'Error de Stripe: La tarjeta fue rechazada'
    })
    message: string;

    @ApiProperty({
        description: 'Tipo de error',
        example: 'Bad Request'
    })
    error: string;
}

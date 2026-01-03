import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
    @ApiProperty({
        description: 'Mission ID for the payment',
        example: '673ab2c3e8f9a1234567890c',
    })
    @IsString()
    missionId: string;

    @ApiProperty({
        description: 'Payment method ID from Stripe (optional, uses default if not provided)',
        example: 'pm_1234567890',
        required: false,
    })
    @IsString()
    @IsOptional()
    paymentMethodId?: string;
}

export class ConfirmPaymentDto {
    @ApiProperty({
        description: 'Payment Intent ID from Stripe',
        example: 'pi_1234567890',
    })
    @IsString()
    paymentIntentId: string;

    @ApiProperty({
        description: 'Mission ID for the payment',
        example: '673ab2c3e8f9a1234567890c',
    })
    @IsString()
    missionId: string;
}

export class CreateConnectAccountDto {
    @ApiProperty({
        description: 'Email address for the Connect account',
        example: 'talent@example.com',
    })
    @IsString()
    email: string;

    @ApiProperty({
        description: 'Country code (ISO 3166-1 alpha-2)',
        example: 'FR',
    })
    @IsString()
    country: string;
}

export class RequestPayoutDto {
    @ApiProperty({
        description: 'Amount to payout in cents',
        example: 10000,
    })
    @IsNumber()
    amount: number;
}

export class CreateCheckoutSessionDto {
    @ApiProperty({
        description: 'Success URL for redirect after payment completion',
        example: 'matchify://payment/success',
    })
    @IsString()
    successUrl: string;

    @ApiProperty({
        description: 'Cancel URL for redirect when payment is cancelled',
        example: 'matchify://payment/cancel',
    })
    @IsString()
    cancelUrl: string;
}

export class CheckoutSessionResponseDto {
    @ApiProperty({
        description: 'Stripe Checkout Session ID',
        example: 'cs_test_a1b2c3d4e5f6g7h8i9j0',
    })
    sessionId: string;

    @ApiProperty({
        description: 'URL to load in WebView for payment',
        example: 'https://checkout.stripe.com/c/pay/cs_test_...',
    })
    checkoutUrl: string;
}

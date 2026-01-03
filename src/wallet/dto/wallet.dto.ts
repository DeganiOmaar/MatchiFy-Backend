import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddPaymentMethodDto {
    @ApiProperty({
        description: 'Stripe payment method ID',
        example: 'pm_1234567890',
    })
    @IsString()
    paymentMethodId: string;
}

export class SetDefaultPaymentMethodDto {
    @ApiProperty({
        description: 'Stripe payment method ID to set as default',
        example: 'pm_1234567890',
    })
    @IsString()
    paymentMethodId: string;
}

export class RequestPayoutDto {
    @ApiProperty({
        description: 'Amount to payout (in euros)',
        example: 100,
    })
    @IsNumber()
    amount: number;
}

export class GetTransactionsDto {
    @ApiProperty({
        description: 'Page number',
        example: 1,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    page?: number;

    @ApiProperty({
        description: 'Items per page',
        example: 20,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    limit?: number;

    @ApiProperty({
        description: 'Filter by status',
        example: 'completed',
        required: false,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    })
    @IsString()
    @IsOptional()
    @IsEnum(['pending', 'processing', 'completed', 'failed', 'refunded'])
    status?: string;
}

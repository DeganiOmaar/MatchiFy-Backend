import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    RawBodyRequest,
    Req,
    Headers,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
    ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PaymentService } from './payment.service';
import { Mission, MissionDocument } from '../missions/schemas/mission.schema';
import {
    CreatePaymentIntentDto,
    ConfirmPaymentDto,
    CreateConnectAccountDto,
    CreateCheckoutSessionDto,
    CheckoutSessionResponseDto,
} from './dto/payment.dto';

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
    constructor(
        private readonly paymentService: PaymentService,
        @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    ) { }

    @Post('create-intent')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('recruiter')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Create payment intent for mission payment',
        description: 'Creates a Stripe PaymentIntent for paying a talent after mission completion',
    })
    @ApiBody({ type: CreatePaymentIntentDto })
    @ApiResponse({
        status: 200,
        description: 'Payment intent created successfully',
        schema: {
            example: {
                clientSecret: 'pi_xxx_secret_xxx',
                paymentIntentId: 'pi_1234567890',
                customerId: 'cus_1234567890',
                ephemeralKey: 'ek_test_1234567890',
                publishableKey: 'pk_test_1234567890',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a recruiter' })
    async createPaymentIntent(
        @Request() req: any,
        @Body() createPaymentIntentDto: CreatePaymentIntentDto,
    ) {
        const recruiterId = req.user.id;

        const mission = await this.missionModel.findById(createPaymentIntentDto.missionId);
        if (!mission) {
            throw new NotFoundException('Mission not found');
        }

        // Optional: Verify recruiter owns the mission
        if (mission.recruiterId !== recruiterId) {
            // For now, allowing if role is recruiter, but ideally check ownership
            // throw new ForbiddenException('You are not the recruiter for this mission');
        }

        if (!mission.assignedTalentId) {
            throw new BadRequestException('Mission has no assigned talent');
        }

        return this.paymentService.createPaymentIntent(
            createPaymentIntentDto.missionId,
            recruiterId,
            mission.assignedTalentId,
            mission.budget,
            createPaymentIntentDto.paymentMethodId,
        );
    }

    @Post('confirm')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('recruiter')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Confirm payment and transfer to talent',
        description: 'Confirms a successful payment and initiates transfer to talent',
    })
    @ApiBody({ type: ConfirmPaymentDto })
    @ApiResponse({
        status: 200,
        description: 'Payment confirmed and transfer initiated',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Transaction not found' })
    async confirmPayment(@Body() confirmPaymentDto: ConfirmPaymentDto) {
        return this.paymentService.confirmPayment(
            confirmPaymentDto.paymentIntentId,
            confirmPaymentDto.missionId,
        );
    }

    @Post('create-checkout-session/:missionId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('recruiter')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Create Stripe Checkout Session for mission payment',
        description: 'Creates a Stripe Checkout Session for WebView-based payment flow',
    })
    @ApiParam({
        name: 'missionId',
        description: 'Mission ID for the payment',
        example: '673ab2c3e8f9a1234567890c',
    })
    @ApiBody({ type: CreateCheckoutSessionDto })
    @ApiResponse({
        status: 200,
        description: 'Checkout session created successfully',
        type: CheckoutSessionResponseDto,
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a recruiter' })
    @ApiResponse({ status: 404, description: 'Mission not found' })
    async createCheckoutSession(
        @Param('missionId') missionId: string,
        @Body() dto: CreateCheckoutSessionDto,
        @Request() req: any,
    ): Promise<CheckoutSessionResponseDto> {
        const recruiterId = req.user.id;
        return this.paymentService.createCheckoutSession(missionId, recruiterId, dto);
    }

    @Post('connect/create')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('talent')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Create Stripe Connect account for talent',
        description: 'Creates a Stripe Connect Express account for receiving payments',
    })
    @ApiBody({ type: CreateConnectAccountDto })
    @ApiResponse({
        status: 200,
        description: 'Connect account created successfully',
        schema: {
            example: {
                accountId: 'acct_1234567890',
                onboardingUrl: 'https://connect.stripe.com/setup/...',
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a talent' })
    async createConnectAccount(
        @Request() req: any,
        @Body() createConnectAccountDto: CreateConnectAccountDto,
    ) {
        const talentId = req.user.id;
        return this.paymentService.createConnectAccount(
            talentId,
            createConnectAccountDto.email,
            createConnectAccountDto.country,
        );
    }

    @Get('connect/status/:accountId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('talent')
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Get Connect account status',
        description: 'Retrieves the verification and capabilities status of a Connect account',
    })
    @ApiParam({
        name: 'accountId',
        description: 'Stripe Connect account ID',
        example: 'acct_1234567890',
    })
    @ApiResponse({
        status: 200,
        description: 'Connect account status retrieved',
        schema: {
            example: {
                verified: true,
                chargesEnabled: true,
                payoutsEnabled: true,
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Account not found' })
    async getConnectAccountStatus(@Param('accountId') accountId: string) {
        return this.paymentService.getConnectAccountStatus(accountId);
    }

    @Post('webhook')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Stripe webhook endpoint',
        description: 'Handles Stripe webhook events (public endpoint)',
    })
    @ApiResponse({ status: 200, description: 'Webhook processed' })
    async handleWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers('stripe-signature') signature: string,
    ) {
        // Verify webhook signature
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET not configured');
        }

        try {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const event = stripe.webhooks.constructEvent(
                req.rawBody,
                signature,
                webhookSecret,
            );

            await this.paymentService.handleWebhook(event);

            return { received: true };
        } catch (error) {
            console.error('Webhook error:', error.message);
            throw error;
        }
    }

    @Get('transactions/:id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Get transaction details',
        description: 'Retrieves details of a specific payment transaction',
    })
    @ApiParam({
        name: 'id',
        description: 'Transaction ID',
        example: '673ab2c3e8f9a1234567890c',
    })
    @ApiResponse({
        status: 200,
        description: 'Transaction details retrieved',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Transaction not found' })
    async getTransaction(@Param('id') id: string) {
        return this.paymentService.getTransaction(id);
    }
}

import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WalletService } from './wallet.service';
import {
    AddPaymentMethodDto,
    SetDefaultPaymentMethodDto,
    RequestPayoutDto,
    GetTransactionsDto,
} from './dto/wallet.dto';

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @Get('summary')
    @Roles('talent', 'recruiter')
    @ApiOperation({
        summary: 'Get wallet summary',
        description: 'Retrieves wallet balance and summary information',
    })
    @ApiResponse({
        status: 200,
        description: 'Wallet summary retrieved successfully',
        schema: {
            example: {
                userId: '673ab2c3e8f9a1234567890b',
                role: 'talent',
                availableBalance: 1500,
                pendingBalance: 500,
                totalEarned: 2000,
                totalSpent: 0,
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getWalletSummary(@Request() req: any) {
        const userId = req.user.id;
        const role = req.user.role;
        return this.walletService.getWalletSummary(userId, role);
    }

    @Get('transactions')
    @Roles('talent', 'recruiter')
    @ApiOperation({
        summary: 'Get transaction history',
        description: 'Retrieves paginated transaction history with optional filters',
    })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    @ApiQuery({
        name: 'status',
        required: false,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    })
    @ApiResponse({
        status: 200,
        description: 'Transactions retrieved successfully',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getTransactions(
        @Request() req: any,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('status') status?: string,
    ) {
        const userId = req.user.id;
        const role = req.user.role;
        return this.walletService.getTransactions(
            userId,
            role,
            page || 1,
            limit || 20,
            status,
        );
    }

    @Get('transactions/:id')
    @Roles('talent', 'recruiter')
    @ApiOperation({
        summary: 'Get transaction details',
        description: 'Retrieves detailed information about a specific transaction',
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
    async getTransactionDetails(@Param('id') id: string, @Request() req: any) {
        const userId = req.user.id;
        return this.walletService.getTransactionDetails(id, userId);
    }

    @Get('payment-methods')
    @Roles('recruiter')
    @ApiOperation({
        summary: 'Get payment methods',
        description: 'Retrieves list of saved payment methods for recruiter',
    })
    @ApiResponse({
        status: 200,
        description: 'Payment methods retrieved successfully',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a recruiter' })
    async getPaymentMethods(@Request() req: any) {
        const userId = req.user.id;
        return this.walletService.getPaymentMethods(userId);
    }

    @Post('payment-methods')
    @Roles('recruiter')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Add payment method',
        description: 'Adds a new payment method to recruiter account',
    })
    @ApiBody({ type: AddPaymentMethodDto })
    @ApiResponse({
        status: 200,
        description: 'Payment method added successfully',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a recruiter' })
    async addPaymentMethod(
        @Request() req: any,
        @Body() addPaymentMethodDto: AddPaymentMethodDto,
    ) {
        const userId = req.user.id;
        return this.walletService.addPaymentMethod(
            userId,
            addPaymentMethodDto.paymentMethodId,
        );
    }

    @Put('payment-methods/:id/default')
    @Roles('recruiter')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Set default payment method',
        description: 'Sets a payment method as the default for future payments',
    })
    @ApiParam({
        name: 'id',
        description: 'Payment method ID',
        example: 'pm_1234567890',
    })
    @ApiResponse({
        status: 200,
        description: 'Default payment method updated',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a recruiter' })
    async setDefaultPaymentMethod(@Param('id') id: string, @Request() req: any) {
        const userId = req.user.id;
        await this.walletService.setDefaultPaymentMethod(userId, id);
        return { message: 'Default payment method updated' };
    }

    @Delete('payment-methods/:id')
    @Roles('recruiter')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Remove payment method',
        description: 'Removes a payment method from recruiter account',
    })
    @ApiParam({
        name: 'id',
        description: 'Payment method ID',
        example: 'pm_1234567890',
    })
    @ApiResponse({
        status: 200,
        description: 'Payment method removed',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a recruiter' })
    async removePaymentMethod(@Param('id') id: string) {
        await this.walletService.removePaymentMethod(id);
        return { message: 'Payment method removed' };
    }

    @Get('payout-status')
    @Roles('talent')
    @ApiOperation({
        summary: 'Get payout status',
        description: 'Retrieves payout status and history for talent',
    })
    @ApiResponse({
        status: 200,
        description: 'Payout status retrieved',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a talent' })
    async getPayoutStatus(@Request() req: any) {
        const userId = req.user.id;
        return this.walletService.getPayoutStatus(userId);
    }

    @Post('payout')
    @Roles('talent')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Request payout',
        description: 'Requests a payout to talent bank account',
    })
    @ApiBody({ type: RequestPayoutDto })
    @ApiResponse({
        status: 200,
        description: 'Payout requested successfully',
    })
    @ApiResponse({ status: 400, description: 'Insufficient balance' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Not a talent' })
    async requestPayout(
        @Request() req: any,
        @Body() requestPayoutDto: RequestPayoutDto,
    ) {
        const userId = req.user.id;
        return this.walletService.requestPayout(userId, requestPayoutDto.amount);
    }
}

import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Wallet, WalletDocument } from './schemas/wallet.schema';
import { PaymentService } from '../payment/payment.service';
import {
    PaymentTransaction,
    PaymentTransactionDocument,
    TransactionStatus,
} from '../payment/schemas/payment-transaction.schema';

@Injectable()
export class WalletService {
    private stripe: Stripe;

    constructor(
        @InjectModel(Wallet.name)
        private walletModel: Model<WalletDocument>,
        @InjectModel(PaymentTransaction.name)
        private paymentTransactionModel: Model<PaymentTransactionDocument>,
        @Inject(forwardRef(() => PaymentService))
        private paymentService: PaymentService,
        private configService: ConfigService,
    ) {
        const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }
        this.stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2025-11-17.clover',
        });
    }

    /**
     * Get or create wallet for user
     */
    async getOrCreateWallet(
        userId: string,
        role: 'talent' | 'recruiter',
    ): Promise<WalletDocument> {
        let wallet = await this.walletModel.findOne({ userId });

        if (!wallet) {
            wallet = await this.walletModel.create({
                userId,
                role,
                availableBalance: 0,
                pendingBalance: 0,
                totalEarned: 0,
                totalSpent: 0,
            });
        }

        return wallet;
    }

    /**
     * Get wallet summary
     */
    async getWalletSummary(
        userId: string,
        role: 'talent' | 'recruiter',
    ): Promise<WalletDocument> {
        const wallet = await this.getOrCreateWallet(userId, role);

        // Recalculate balances from transactions
        await this.recalculateBalance(userId, role);

        const updatedWallet = await this.walletModel.findOne({ userId });
        if (!updatedWallet) {
            throw new NotFoundException('Wallet not found');
        }
        return updatedWallet;
    }

    /**
     * Recalculate wallet balance from transactions
     */
    public async recalculateBalance(
        userId: string,
        role: 'talent' | 'recruiter',
    ): Promise<void> {
        const wallet = await this.walletModel.findOne({ userId });
        if (!wallet) return;

        const query = role === 'talent' ? { talentId: userId } : { recruiterId: userId };

        // Calculate totals
        const completedTransactions = await this.paymentTransactionModel.find({
            ...query,
            status: TransactionStatus.COMPLETED,
        });

        const pendingTransactions = await this.paymentTransactionModel.find({
            ...query,
            status: { $in: [TransactionStatus.PENDING, TransactionStatus.PROCESSING] },
        });

        if (role === 'talent') {
            wallet.availableBalance = completedTransactions.reduce(
                (sum, t) => sum + t.talentAmount,
                0,
            );
            wallet.pendingBalance = pendingTransactions.reduce(
                (sum, t) => sum + t.talentAmount,
                0,
            );
            wallet.totalEarned = wallet.availableBalance;
        } else {
            wallet.totalSpent = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
        }

        await wallet.save();
    }

    /**
     * Get transactions with pagination and filters
     */
    async getTransactions(
        userId: string,
        role: 'talent' | 'recruiter',
        page: number = 1,
        limit: number = 20,
        status?: string,
    ): Promise<{ transactions: PaymentTransactionDocument[]; total: number; pages: number }> {
        const query: any = role === 'talent' ? { talentId: userId } : { recruiterId: userId };

        if (status) {
            query.status = status;
        }

        const [transactions, total] = await Promise.all([
            this.paymentTransactionModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .exec(),
            this.paymentTransactionModel.countDocuments(query),
        ]);

        return {
            transactions,
            total,
            pages: Math.ceil(total / limit),
        };
    }

    /**
     * Get transaction details
     */
    async getTransactionDetails(
        transactionId: string,
        userId: string,
    ): Promise<PaymentTransactionDocument> {
        const transaction = await this.paymentTransactionModel.findById(transactionId);

        if (!transaction) {
            throw new NotFoundException('Transaction not found');
        }

        // Verify user has access to this transaction
        if (transaction.talentId !== userId && transaction.recruiterId !== userId) {
            throw new BadRequestException('Access denied to this transaction');
        }

        return transaction;
    }

    /**
     * Add payment method to customer
     */
    async addPaymentMethod(
        userId: string,
        paymentMethodId: string,
    ): Promise<Stripe.PaymentMethod> {
        try {
            const wallet = await this.getOrCreateWallet(userId, 'recruiter');

            // Get or create Stripe customer
            let customerId = wallet.stripeCustomerId;
            if (!customerId) {
                const customer = await this.stripe.customers.create({
                    metadata: { userId },
                });
                customerId = customer.id;
                wallet.stripeCustomerId = customerId;
                await wallet.save();
            }

            // Attach payment method to customer
            const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });

            return paymentMethod;
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to add payment method: ${error.message}`,
            );
        }
    }

    /**
     * Get payment methods for customer
     */
    async getPaymentMethods(userId: string): Promise<Stripe.PaymentMethod[]> {
        try {
            const wallet = await this.walletModel.findOne({ userId });

            if (!wallet?.stripeCustomerId) {
                return [];
            }

            const paymentMethods = await this.stripe.paymentMethods.list({
                customer: wallet.stripeCustomerId,
                type: 'card',
            });

            return paymentMethods.data;
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to get payment methods: ${error.message}`,
            );
        }
    }

    /**
     * Set default payment method
     */
    async setDefaultPaymentMethod(
        userId: string,
        paymentMethodId: string,
    ): Promise<void> {
        try {
            const wallet = await this.walletModel.findOne({ userId });

            if (!wallet?.stripeCustomerId) {
                throw new NotFoundException('Customer not found');
            }

            await this.stripe.customers.update(wallet.stripeCustomerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to set default payment method: ${error.message}`,
            );
        }
    }

    /**
     * Remove payment method
     */
    async removePaymentMethod(paymentMethodId: string): Promise<void> {
        try {
            await this.stripe.paymentMethods.detach(paymentMethodId);
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to remove payment method: ${error.message}`,
            );
        }
    }

    /**
     * Request payout for talent
     */
    async requestPayout(userId: string, amount: number): Promise<any> {
        try {
            const wallet = await this.walletModel.findOne({ userId });

            if (!wallet) {
                throw new NotFoundException('Wallet not found');
            }

            if (wallet.availableBalance < amount) {
                throw new BadRequestException('Insufficient balance');
            }

            if (!wallet.stripeConnectAccountId) {
                throw new BadRequestException('Connect account not set up');
            }

            // Create payout
            const payout = await this.stripe.payouts.create(
                {
                    amount: amount * 100, // Convert to cents
                    currency: 'eur',
                },
                {
                    stripeAccount: wallet.stripeConnectAccountId,
                },
            );

            // Update wallet balance
            wallet.availableBalance -= amount;
            await wallet.save();

            return payout;
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to request payout: ${error.message}`,
            );
        }
    }

    /**
     * Get payout status for talent
     */
    async getPayoutStatus(userId: string): Promise<any> {
        try {
            const wallet = await this.walletModel.findOne({ userId });

            if (!wallet?.stripeConnectAccountId) {
                return { hasConnectAccount: false };
            }

            // Get recent payouts
            const payouts = await this.stripe.payouts.list(
                {
                    limit: 10,
                },
                {
                    stripeAccount: wallet.stripeConnectAccountId,
                },
            );

            return {
                hasConnectAccount: true,
                payouts: payouts.data,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to get payout status: ${error.message}`,
            );
        }
    }

    /**
     * Update wallet with Stripe Connect account ID
     */
    async updateConnectAccountId(userId: string, accountId: string): Promise<void> {
        const wallet = await this.getOrCreateWallet(userId, 'talent');
        wallet.stripeConnectAccountId = accountId;
        await wallet.save();
    }
}

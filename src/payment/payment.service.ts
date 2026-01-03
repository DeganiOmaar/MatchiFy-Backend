import {
    Injectable,
    BadRequestException,
    NotFoundException,
    InternalServerErrorException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
    PaymentTransaction,
    PaymentTransactionDocument,
    TransactionStatus,
    TransactionDirection,
} from './schemas/payment-transaction.schema';
import { Mission, MissionDocument } from '../missions/schemas/mission.schema';
import { WalletService } from '../wallet/wallet.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class PaymentService {
    private stripe: Stripe;
    private platformFeePercentage = 0.03; // 3% platform fee

    constructor(
        @InjectModel(PaymentTransaction.name)
        private paymentTransactionModel: Model<PaymentTransactionDocument>,
        @InjectModel(Mission.name)
        private missionModel: Model<MissionDocument>,
        private configService: ConfigService,
        @Inject(forwardRef(() => WalletService))
        private walletService: WalletService,
    ) {
        const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            throw new Error('STRIPE_SECRET_KEY is not configured in environment variables');
        }
        this.stripe = new Stripe(stripeSecretKey, {
        });
    }

    /**
     * Create a PaymentIntent for a mission payment
     */
    async createPaymentIntent(
        missionId: string,
        recruiterId: string,
        talentId: string,
        amount: number,
        paymentMethodId?: string,
    ): Promise<{
        clientSecret: string;
        paymentIntentId: string;
        customerId: string;
        ephemeralKey: string;
        publishableKey: string;
    }> {
        try {
            // Calculate platform fee and talent amount
            const platformFee = Math.round(amount * this.platformFeePercentage);
            const talentAmount = amount - platformFee;

            // Get or create Stripe customer for recruiter
            const customer = await this.getOrCreateCustomer(recruiterId);

            // Create payment intent
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: amount * 100, // Convert to cents
                currency: 'eur',
                customer: customer.id,
                payment_method: paymentMethodId,
                metadata: {
                    missionId,
                    recruiterId,
                    talentId,
                    platformFee: platformFee.toString(),
                    talentAmount: talentAmount.toString(),
                },
                automatic_payment_methods: paymentMethodId
                    ? undefined
                    : { enabled: true },
                // Use off_session if paying with a saved card directly to avoid 3DS interruption if possible
                // or 'setup_future_usage' if we want to save this card
                setup_future_usage: 'off_session',
            });

            // Create transaction record
            await this.paymentTransactionModel.create({
                missionId,
                recruiterId,
                talentId,
                amount,
                platformFee,
                talentAmount,
                stripePaymentIntentId: paymentIntent.id,
                status: TransactionStatus.PENDING,
                direction: TransactionDirection.OUT,
            });

            // Create Ephemeral Key
            const ephemeralKey = await this.stripe.ephemeralKeys.create(
                { customer: customer.id },
                { apiVersion: '2024-11-20.acacia' }
            );

            return {
                clientSecret: paymentIntent.client_secret!,
                paymentIntentId: paymentIntent.id,
                customerId: customer.id,
                ephemeralKey: ephemeralKey.secret!,
                publishableKey: this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') || '',
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to create payment intent: ${error.message}`,
            );
        }
    }

    /**
     * Confirm payment and transfer to talent
     */
    async confirmPayment(
        paymentIntentId: string,
        missionId: string,
    ): Promise<PaymentTransactionDocument> {
        try {
            // Retrieve payment intent from Stripe
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status !== 'succeeded') {
                throw new BadRequestException('Payment has not succeeded yet');
            }

            // Find transaction record
            const transaction = await this.paymentTransactionModel.findOne({
                stripePaymentIntentId: paymentIntentId,
                missionId,
            });

            if (!transaction) {
                throw new NotFoundException('Transaction not found');
            }

            // Update transaction status
            transaction.status = TransactionStatus.PROCESSING;
            await transaction.save();

            // Transfer to talent's Connect account (if they have one)
            const transfer = await this.transferToTalent(
                transaction.talentAmount,
                transaction.talentId,
                missionId,
            );

            // Update transaction with transfer ID if successful
            if (transfer) {
                transaction.stripeTransferId = transfer.id;
            }

            transaction.status = TransactionStatus.COMPLETED;
            transaction.completedAt = new Date();
            await transaction.save();

            // Recalculate wallets for both parties
            await this.walletService.recalculateBalance(transaction.recruiterId, 'recruiter');
            await this.walletService.recalculateBalance(transaction.talentId, 'talent');

            // Update Mission Status to PAID
            await this.missionModel.findByIdAndUpdate(missionId, {
                status: 'paid',
                paymentStatus: 'paid',
                paymentTransactionId: paymentIntentId,
            });

            return transaction;
        } catch (error) {
            // Update transaction status to failed
            const transaction = await this.paymentTransactionModel.findOne({
                stripePaymentIntentId: paymentIntentId,
            });
            if (transaction) {
                transaction.status = TransactionStatus.FAILED;
                transaction.errorMessage = error.message;
                await transaction.save();
            }

            throw new InternalServerErrorException(
                `Failed to confirm payment: ${error.message}`,
            );
        }
    }

    /**
     * Create Stripe Connect account for talent
     */
    async createConnectAccount(
        talentId: string,
        email: string,
        country: string = 'FR',
    ): Promise<{ accountId: string; onboardingUrl: string }> {
        try {
            // Create Connect account
            const account = await this.stripe.accounts.create({
                type: 'express',
                country,
                email,
                capabilities: {
                    transfers: { requested: true },
                },
                metadata: {
                    talentId,
                },
            });

            // Create account link for onboarding
            const accountLink = await this.stripe.accountLinks.create({
                account: account.id,
                refresh_url: `${this.configService.get('FRONTEND_URL')}/wallet/connect/refresh`,
                return_url: `${this.configService.get('FRONTEND_URL')}/wallet/connect/success`,
                type: 'account_onboarding',
            });

            return {
                accountId: account.id,
                onboardingUrl: accountLink.url,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to create Connect account: ${error.message}`,
            );
        }
    }

    /**
     * Get Connect account status
     */
    async getConnectAccountStatus(accountId: string): Promise<{
        verified: boolean;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
    }> {
        try {
            const account = await this.stripe.accounts.retrieve(accountId);

            return {
                verified: account.details_submitted || false,
                chargesEnabled: account.charges_enabled || false,
                payoutsEnabled: account.payouts_enabled || false,
            };
        } catch (error) {
            throw new NotFoundException('Connect account not found');
        }
    }

    /**
     * Transfer funds to talent's Connect account
     */
    private async transferToTalent(
        amount: number,
        talentId: string,
        missionId: string,
    ): Promise<Stripe.Transfer | null> {
        try {
            // Get talent's wallet to find Connect account ID
            const wallet = await this.walletService.getOrCreateWallet(
                talentId,
                'talent',
            );

            const connectAccountId = wallet.stripeConnectAccountId;

            if (!connectAccountId || connectAccountId === 'acct_PLACEHOLDER') {
                console.warn(`[PAYMENT] Skipping Stripe transfer: Talent ${talentId} has no Connect account linked.`);
                return null;
            }

            const transfer = await this.stripe.transfers.create({
                amount: Math.round(amount * 100), // Convert to cents and ensure integer
                currency: 'eur',
                destination: connectAccountId,
                metadata: {
                    talentId,
                    missionId,
                },
            });

            return transfer;
        } catch (error) {
            console.error(`[PAYMENT] Transfer failed: ${error.message}`);
            // We don't throw here to allow the internal balance to be updated 
            // even if Stripe transfer fails (e.g. account restricted)
            return null;
        }
    }

    /**
     * Get or create Stripe customer for recruiter
     */
    private async getOrCreateCustomer(recruiterId: string): Promise<Stripe.Customer> {
        try {
            // Search for existing customer
            const customers = await this.stripe.customers.list({
                limit: 1,
                email: `recruiter_${recruiterId}@matchify.com`, // Placeholder, should use actual email
            });

            if (customers.data.length > 0) {
                return customers.data[0];
            }

            // Create new customer
            const customer = await this.stripe.customers.create({
                email: `recruiter_${recruiterId}@matchify.com`,
                metadata: {
                    recruiterId,
                },
            });

            return customer;
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to get or create customer: ${error.message}`,
            );
        }
    }

    /**
     * Handle Stripe webhook events
     */
    async handleWebhook(event: Stripe.Event): Promise<void> {
        try {
            switch (event.type) {
                case 'payment_intent.succeeded':
                    await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
                    break;
                case 'checkout.session.completed':
                    await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
                    break;
                case 'transfer.created':
                    // Handle transfer created
                    break;
                case 'transfer.updated':
                    // Handle transfer updated
                    break;
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
        } catch (error) {
            console.error('Webhook handling error:', error);
        }
    }

    private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
        const transaction = await this.paymentTransactionModel.findOne({
            stripePaymentIntentId: paymentIntent.id,
        });

        if (transaction && transaction.status === TransactionStatus.PENDING) {
            transaction.status = TransactionStatus.PROCESSING;
            await transaction.save();
        }
    }

    private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
        const transaction = await this.paymentTransactionModel.findOne({
            stripePaymentIntentId: paymentIntent.id,
        });

        if (transaction) {
            transaction.status = TransactionStatus.FAILED;
            transaction.errorMessage = 'Payment failed';
            await transaction.save();
        }
    }

    private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
        try {
            const missionId = session.metadata?.missionId;
            const talentId = session.metadata?.talentId;
            const talentAmount = parseFloat(session.metadata?.talentAmount || '0');

            if (!missionId) {
                console.error('Checkout session missing missionId in metadata');
                return;
            }

            // Find the transaction record
            const transaction = await this.paymentTransactionModel.findOne({
                missionId,
                status: TransactionStatus.PENDING,
            }).sort({ createdAt: -1 });

            if (!transaction) {
                console.error(`No pending transaction found for mission ${missionId}`);
                return;
            }

            // Update transaction with payment intent ID from session
            if (session.payment_intent) {
                transaction.stripePaymentIntentId = session.payment_intent as string;
            }

            transaction.status = TransactionStatus.PROCESSING;
            await transaction.save();

            // Transfer to talent's Connect account
            const transfer = await this.transferToTalent(
                talentAmount,
                talentId!,
                missionId,
            );

            // Update transaction with transfer ID if successful
            if (transfer) {
                transaction.stripeTransferId = transfer.id;
            }

            transaction.status = TransactionStatus.COMPLETED;
            transaction.completedAt = new Date();
            await transaction.save();

            // Recalculate wallets for both parties
            await this.walletService.recalculateBalance(transaction.recruiterId, 'recruiter');
            await this.walletService.recalculateBalance(transaction.talentId, 'talent');

            // Update Mission Status to PAID
            await this.missionModel.findByIdAndUpdate(missionId, {
                status: 'paid',
                paymentStatus: 'paid',
                paymentTransactionId: session.payment_intent as string || session.id,
            });

            console.log(`✅ Checkout session completed for mission ${missionId}`);
        } catch (error) {
            console.error('Error handling checkout session completion:', error);
        }
    }

    /**
     * Get transaction by ID
     */
    async getTransaction(transactionId: string): Promise<PaymentTransactionDocument> {
        const transaction = await this.paymentTransactionModel.findById(transactionId);
        if (!transaction) {
            throw new NotFoundException('Transaction not found');
        }
        return transaction;
    }

    /**
     * Get transactions for a user
     */
    async getTransactions(
        userId: string,
        role: 'talent' | 'recruiter',
        page: number = 1,
        limit: number = 20,
    ): Promise<{ transactions: PaymentTransactionDocument[]; total: number }> {
        const query = role === 'talent' ? { talentId: userId } : { recruiterId: userId };

        const [transactions, total] = await Promise.all([
            this.paymentTransactionModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .exec(),
            this.paymentTransactionModel.countDocuments(query),
        ]);

        return { transactions, total };
    }

    /**
     * Create Stripe Checkout Session for WebView payment
     */
    async createCheckoutSession(
        missionId: string,
        recruiterId: string,
        dto: any, // CreateCheckoutSessionDto
    ): Promise<{ sessionId: string; checkoutUrl: string }> {
        try {
            // Fetch mission to get budget and validate
            const mission = await this.missionModel.findById(missionId);
            if (!mission) {
                throw new NotFoundException('Mission not found');
            }

            // Verify recruiter owns the mission
            if (mission.recruiterId !== recruiterId) {
                throw new ForbiddenException('You are not the recruiter for this mission');
            }

            if (!mission.assignedTalentId) {
                throw new BadRequestException('Mission has no assigned talent');
            }

            const amount = mission.budget;
            const platformFee = Math.round(amount * this.platformFeePercentage);
            const talentAmount = amount - platformFee;

            // Get or create Stripe customer for recruiter
            const customer = await this.getOrCreateCustomer(recruiterId);

            // Create Checkout Session
            const session = await this.stripe.checkout.sessions.create({
                customer: customer.id,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            product_data: {
                                name: `Mission Payment - ${mission.title || 'Mission'}`,
                                description: `Payment for mission completion (Platform fee: €${platformFee})`,
                            },
                            unit_amount: amount * 100, // Convert to cents
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: dto.successUrl,
                cancel_url: dto.cancelUrl,
                metadata: {
                    missionId,
                    recruiterId,
                    talentId: mission.assignedTalentId,
                    platformFee: platformFee.toString(),
                    talentAmount: talentAmount.toString(),
                },
            });

            // Create pending transaction record
            await this.paymentTransactionModel.create({
                missionId,
                recruiterId,
                talentId: mission.assignedTalentId,
                amount,
                platformFee,
                talentAmount,
                stripePaymentIntentId: session.payment_intent as string || session.id, // Will be updated by webhook
                status: TransactionStatus.PENDING,
                direction: TransactionDirection.OUT,
            });

            return {
                sessionId: session.id,
                checkoutUrl: session.url!,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to create checkout session: ${error.message}`,
            );
        }
    }

    /**
     * Approve completion and release payment
     */
    async approveCompletion(
        missionId: string,
        recruiterId: string,
    ): Promise<PaymentTransactionDocument> {
        // Find the pending transaction for this mission
        const transaction = await this.paymentTransactionModel.findOne({
            missionId,
            status: TransactionStatus.PENDING
        }).sort({ createdAt: -1 });

        if (!transaction) {
            throw new NotFoundException('No pending payment transaction found for this mission');
        }

        // Verify recruiter
        if (transaction.recruiterId !== recruiterId) {
            throw new ForbiddenException('Not authorized to approve this payment');
        }

        if (!transaction.stripePaymentIntentId) {
            throw new InternalServerErrorException('Transaction record is missing Stripe Payment Intent ID');
        }

        // Confirm the payment (release funds)
        return this.confirmPayment(transaction.stripePaymentIntentId, missionId);
    }
}

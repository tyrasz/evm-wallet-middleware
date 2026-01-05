
import { PrismaClient, Stream } from '@prisma/client';
import { WalletService } from './wallet.service';

export class StreamService {
    private isProcessing = false;

    constructor(
        private prisma: PrismaClient,
        private walletService: WalletService
    ) { }

    // Start the scheduler
    start(intervalMs: number = 60000) {
        console.log('Starting Stream Scheduler...');
        setInterval(() => this.processStreams(), intervalMs);
    }

    async createStream(data: {
        walletId: string,
        receiverAddress: string,
        tokenAddress: string,
        amountPerPeriod: string,
        intervalSeconds: number
    }) {
        const wallet = await this.prisma.wallet.findUnique({ where: { id: data.walletId } });
        if (!wallet) throw new Error('Wallet not found');

        // Check if token info is valid (optional, but good practice)
        await this.walletService.getERC20TokenInfo(wallet.address, data.tokenAddress);

        return this.prisma.stream.create({
            data: {
                ...data,
                nextRunAt: new Date(), // Run immediately or scheduling logic? Let's say immediately.
                status: 'ACTIVE'
            }
        });
    }

    async listStreams(walletId?: string) {
        if (walletId) {
            return this.prisma.stream.findMany({ where: { walletId } });
        }
        return this.prisma.stream.findMany(); // Admin view
    }

    async cancelStream(id: string) {
        return this.prisma.stream.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
    }

    async processStreams() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        console.log('Processing streams...');

        try {
            const now = new Date();
            const dueStreams = await this.prisma.stream.findMany({
                where: {
                    status: 'ACTIVE',
                    nextRunAt: { lte: now }
                },
                include: { wallet: true }
            });

            for (const stream of dueStreams) {
                await this.processStream(stream);
            }
        } catch (error) {
            console.error('Error processing streams:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    private async processStream(stream: Stream & { wallet: { address: string } }) {
        try {
            console.log(`Processing stream ${stream.id} for wallet ${stream.wallet.address}`);

            // Execute Transfer
            // We use the wallet service to transfer.
            // Note: We need to get symbol or just pass undefined check.
            // But transferERC20 requires symbol usually for check, but looking at signature:
            // transferERC20(fromAddress, tokenAddress, toAddress, amount, expectedSymbol?)
            // expectedSymbol is optional.

            await this.walletService.transferERC20(
                stream.wallet.address,
                stream.tokenAddress,
                stream.receiverAddress,
                stream.amountPerPeriod
            );

            // Update next run time
            const nextRun = new Date(new Date().getTime() + stream.intervalSeconds * 1000);

            await this.prisma.stream.update({
                where: { id: stream.id },
                data: {
                    lastRunAt: new Date(),
                    nextRunAt: nextRun
                }
            });

            console.log(`Stream ${stream.id} processed successfully.`);

        } catch (error) {
            console.error(`Failed to process stream ${stream.id}:`, error);
            // Optionally pause stream on failure or retry logic
            // For now we assume transient failure and don't change status, 
            // OR we skip update so it retries next tick? 
            // Better to update 'nextRunAt' anyway to avoid spamming if it's a permanent error (like no balance),
            // OR set status to PAUSED.
            // Let's set to PAUSED to be safe.
            await this.prisma.stream.update({
                where: { id: stream.id },
                data: { status: 'PAUSED' } // User must resume
            });
        }
    }
}

import { PrismaClient } from '@prisma/client';
import { chainService } from './chain.service';
import { WebhookService } from './webhook.service';
import { env } from '../config/env';

export class GasMonitorService {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private readonly LOW_BALANCE_THRESHOLD = 0.1; // ETH
    private readonly CHECK_INTERVAL_MS = 60 * 1000 * 5; // 5 minutes

    constructor(
        private prisma: PrismaClient,
        private webhookService: WebhookService
    ) { }

    start() {
        if (this.intervalId) return;
        console.log('⛽ Starting Gas Monitor Service...');
        // Initial check
        this.checkBalances();
        // Periodic check
        this.intervalId = setInterval(() => this.checkBalances(), this.CHECK_INTERVAL_MS);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async checkBalances() {
        try {
            console.log('🔍 Checking wallet balances for gas monitoring...');
            const wallets = await this.prisma.wallet.findMany();

            for (const wallet of wallets) {
                try {
                    const balanceWei = await chainService.getBalance(wallet.address);
                    const balanceEth = parseFloat(balanceWei);

                    if (balanceEth < this.LOW_BALANCE_THRESHOLD) {
                        console.warn(`⚠️ Low Balance Detected: ${wallet.address} (${balanceEth} ETH)`);

                        await this.webhookService.dispatch('WALLET_LOW_BALANCE', {
                            walletId: wallet.id,
                            address: wallet.address,
                            balance: balanceEth.toString(),
                            threshold: this.LOW_BALANCE_THRESHOLD.toString(),
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.error(`Failed to check balance for ${wallet.address}`, err);
                }
            }
        } catch (error) {
            console.error('Gas Monitor Error:', error);
        }
    }
}

import { PrismaClient } from '@prisma/client';
import { parseEther } from 'viem';

export class PolicyService {
    constructor(private prisma: PrismaClient) { }

    async evaluate(context: {
        amount?: string; // in Native Currency (ETH)
        toAddress?: string;
        walletId?: string;
    }): Promise<void> {
        // 1. Fetch Global Policies
        const globalPolicies = await this.prisma.policy.findMany({
            where: {
                scope: 'GLOBAL',
                enabled: true
            }
        });

        // 2. Fetch Wallet-Specific Policies
        const walletPolicies = context.walletId ? await this.prisma.policy.findMany({
            where: {
                scope: 'WALLET',
                entityId: context.walletId,
                enabled: true
            }
        }) : [];

        const allPolicies = [...globalPolicies, ...walletPolicies];

        // 3. Evaluate Policies
        for (const policy of allPolicies) {
            const config = JSON.parse(policy.config);

            switch (policy.type) {
                case 'TRANSACTION_LIMIT':
                    this.checkTransactionLimit(config, context.amount);
                    break;
                case 'WHITELIST':
                    this.checkWhitelist(config, context.toAddress);
                    break;
                default:
                    console.warn(`Unknown policy type: ${policy.type}`);
            }
        }
    }

    private checkTransactionLimit(config: { maxAmount: string }, amount?: string) {
        if (!amount) return; // Cannot check if amount missing

        try {
            const limit = parseEther(config.maxAmount);
            const value = parseEther(amount);

            if (value > limit) {
                throw new Error(`Policy Violation: Transaction amount ${amount} exceeds limit of ${config.maxAmount}`);
            }
        } catch (error) {
            if ((error as Error).message.includes('Policy Violation')) throw error;
            console.warn('Invalid amount format for policy check', error);
        }
    }

    private checkWhitelist(config: { addresses: string[] }, toAddress?: string) {
        if (!toAddress) return;

        const normalizedTo = toAddress.toLowerCase();
        const whitelist = config.addresses.map(a => a.toLowerCase());

        if (!whitelist.includes(normalizedTo)) {
            throw new Error(`Policy Violation: Recipient ${toAddress} is not in the whitelist.`);
        }
    }
}

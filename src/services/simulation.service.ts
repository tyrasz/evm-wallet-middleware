import { chainService } from './chain.service';
import { parseEther, Hex, CallExecutionError } from 'viem';
import { PrismaClient } from '@prisma/client';
import { PolicyService } from './policy.service';

export interface SimulationResult {
    success: boolean;
    gasUsed?: string;
    returnData?: string;
    error?: string;
    simulationType: 'ESTIMATE_GAS' | 'CALL';
    policyStatus?: 'APPROVED' | 'REJECTED';
    policyError?: string;
}

export class SimulationService {
    constructor(
        private prisma: PrismaClient,
        private policyService: PolicyService
    ) { }

    async simulateTransaction(params: {
        fromAddress?: string;
        walletId?: string;
        to: string;
        value?: string;
        data?: string;
        checkPolicy?: boolean;
    }): Promise<SimulationResult> {
        const client = chainService.getClient();
        let from = params.fromAddress;

        // Resolve walletId if provided and fromAddress is missing
        if (!from && params.walletId) {
            const wallet = await this.prisma.wallet.findUnique({
                where: { id: params.walletId }
            });
            if (wallet) {
                from = wallet.address;
            }
        }

        // Policy Check (if requested)
        if (params.checkPolicy) {
            try {
                await this.policyService.evaluate({
                    amount: params.value,
                    toAddress: params.to,
                    walletId: params.walletId
                });
            } catch (error) {
                return {
                    success: false,
                    simulationType: 'ESTIMATE_GAS', // Not strictly true, but we blocked it
                    policyStatus: 'REJECTED',
                    policyError: (error as Error).message
                };
            }
        }

        // Default 'from' is not strictly required for some calls, but realistic for simulation
        // If no from, we might miss balance checks.

        const txParams = {
            account: from as `0x${string}` | undefined,
            to: params.to as `0x${string}`,
            value: params.value ? parseEther(params.value) : undefined,
            data: params.data as Hex | undefined,
        } as any; // Cast to any to avoid strict viem type mismatches with undefined account

        try {
            // 1. Estimate Gas (Checks implicitly if it reverts)
            const gasEstimate = await client.estimateGas(txParams);

            // 2. Call (To get return data)
            const { data: returnData } = await client.call(txParams);

            return {
                success: true,
                gasUsed: gasEstimate.toString(),
                returnData: returnData,
                simulationType: 'ESTIMATE_GAS',
                policyStatus: params.checkPolicy ? 'APPROVED' : undefined
            };

        } catch (error) {
            // If estimateGas fails, it likely reverted
            let errorMessage = (error as Error).message;

            // Try to extract revert reason if possible
            if (error instanceof CallExecutionError) {
                errorMessage = error.shortMessage || errorMessage;
            }

            return {
                success: false,
                error: errorMessage,
                simulationType: 'ESTIMATE_GAS',
                policyStatus: params.checkPolicy ? 'APPROVED' : undefined // Policy passed, but chain failed
            };
        }
    }
}

// Factory/Singleton not strictly needed if we inject prisma provided by app, 
// but for consistency with others we might export a class and instantiate in app or here.
// WalletService is instantiated in app.ts with prisma.
// Let's rely on dependency injection in app.ts for consistency.


import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { StakingService } from '../services/staking.service';
import { WalletService } from '../services/wallet.service';
import { AuditService } from '../services/audit.service';
import { PolicyService } from '../services/policy.service';
import { WebhookService } from '../services/webhook.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';

export default async function stakingRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', authMiddleware);

    // Instantiate Dependencies
    const auditService = new AuditService(fastify.prisma);
    const policyService = new PolicyService(fastify.prisma);
    const webhookService = new WebhookService(fastify.prisma);
    const walletService = new WalletService(fastify.prisma, auditService, policyService, webhookService);

    // Instantiate Staking Service
    const stakingService = new StakingService(fastify.prisma, walletService);

    fastify.post('/wallets/:id/staking/deposit', {
        schema: {
            tags: ['Staking'],
            summary: 'Deposit assets into an ERC4626 vault',
            params: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id']
            },
            body: {
                type: 'object',
                properties: {
                    vaultAddress: { type: 'string' },
                    amount: { type: 'string' }
                },
                required: ['vaultAddress', 'amount']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { vaultAddress, amount } = request.body as { vaultAddress: string; amount: string };

        try {
            const tx = await stakingService.deposit(id, vaultAddress, amount);
            return tx;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Deposit failed', error: (error as Error).message });
        }
    });

    fastify.post('/wallets/:id/staking/withdraw', {
        schema: {
            tags: ['Staking'],
            summary: 'Withdraw assets from an ERC4626 vault',
            params: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id']
            },
            body: {
                type: 'object',
                properties: {
                    vaultAddress: { type: 'string' },
                    amount: { type: 'string' }
                },
                required: ['vaultAddress', 'amount']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { vaultAddress, amount } = request.body as { vaultAddress: string; amount: string };

        try {
            const tx = await stakingService.withdraw(id, vaultAddress, amount);
            return tx;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Withdraw failed', error: (error as Error).message });
        }
    });

    fastify.get('/wallets/:id/staking/:vaultAddress', {
        schema: {
            tags: ['Staking'],
            summary: 'Get staking position',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    vaultAddress: { type: 'string' }
                },
                required: ['id', 'vaultAddress']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { id, vaultAddress } = request.params as { id: string; vaultAddress: string };

        try {
            const position = await stakingService.getPosition(id, vaultAddress);
            return position;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to fetch position', error: (error as Error).message });
        }
    });
}

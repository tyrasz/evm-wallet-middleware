
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TokenService } from '../services/token.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';

export default async function tokenRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', authMiddleware);

    const tokenService = new TokenService(fastify.prisma);

    const addTokenSchema = z.object({
        tokenAddress: z.string(),
    });

    fastify.post('/wallets/:id/tokens', {
        schema: {
            tags: ['Tokens'],
            summary: 'Add a token to watch for a wallet',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' } // Wallet ID or Address? Service uses ID. Let's resolve.
                },
                required: ['id']
            },
            body: {
                type: 'object',
                properties: {
                    tokenAddress: { type: 'string' }
                },
                required: ['tokenAddress']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { tokenAddress } = request.body as { tokenAddress: string };

        // Helper to resolve address to ID if needed? 
        // TokenService expects walletId. If user passes address, we need to find ID.
        // Let's assume ID for now, or update service to lookup.
        // Easier: Look up wallet by ID or Address in service?
        // Let's modify service usage or do lookup here.

        // Actually, let's allow ID to be ID or Address.
        let walletId = id;
        const wallet = await fastify.prisma.wallet.findFirst({
            where: { OR: [{ id }, { address: id }] }
        });

        if (!wallet) return reply.status(404).send({ message: 'Wallet not found' });
        walletId = wallet.id;

        try {
            const token = await tokenService.addToken(walletId, tokenAddress);
            return token;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to add token', error: (error as Error).message });
        }
    });

    fastify.get('/wallets/:id/tokens', {
        schema: {
            tags: ['Tokens'],
            summary: 'List watched tokens for a wallet',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                },
                required: ['id']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        let walletId = id;
        const wallet = await fastify.prisma.wallet.findFirst({
            where: { OR: [{ id }, { address: id }] }
        });

        if (!wallet) return reply.status(404).send({ message: 'Wallet not found' });
        walletId = wallet.id;

        try {
            const tokens = await tokenService.listTokens(walletId);
            return tokens;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to list tokens', error: (error as Error).message });
        }
    });

    fastify.delete('/wallets/:id/tokens/:tokenAddress', {
        schema: {
            tags: ['Tokens'],
            summary: 'Remove a watched token',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    tokenAddress: { type: 'string' }
                },
                required: ['id', 'tokenAddress']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { id, tokenAddress } = request.params as { id: string, tokenAddress: string };

        let walletId = id;
        const wallet = await fastify.prisma.wallet.findFirst({
            where: { OR: [{ id }, { address: id }] }
        });

        if (!wallet) return reply.status(404).send({ message: 'Wallet not found' });
        walletId = wallet.id;

        try {
            await tokenService.removeToken(walletId, tokenAddress);
            return { success: true };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to remove token', error: (error as Error).message });
        }
    });
}

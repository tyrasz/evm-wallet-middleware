
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { StreamService } from '../services/stream.service';
import { WalletService } from '../services/wallet.service';
import { AuditService } from '../services/audit.service';
import { PolicyService } from '../services/policy.service';
import { WebhookService } from '../services/webhook.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';

export default async function streamRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', authMiddleware);

    // Dependencies
    const auditService = new AuditService(fastify.prisma);
    const policyService = new PolicyService(fastify.prisma);
    const webhookService = new WebhookService(fastify.prisma);
    const walletService = new WalletService(fastify.prisma, auditService, policyService, webhookService);

    // Service
    // Note: We are instantiating StreamService here for routes, 
    // BUT we also need it in app.ts to start the scheduler.
    // Ideally it should be a singleton or registered in app.ts.
    // If we instantiate it here, it's fine for handling requests, 
    // but the scheduler instance in app.ts will be different.
    // However, since state is in DB, it's mostly fine, EXCEPT if we want to ensure only one scheduler runs.
    // The scheduler runs on `app.ts` instance.
    // This instance here is for CRUD.
    const streamService = new StreamService(fastify.prisma, walletService);

    fastify.post('/streams', {
        schema: {
            tags: ['Streaming'],
            summary: 'Create a payment stream',
            body: {
                type: 'object',
                properties: {
                    walletId: { type: 'string' },
                    receiverAddress: { type: 'string' },
                    tokenAddress: { type: 'string' },
                    amountPerPeriod: { type: 'string' },
                    intervalSeconds: { type: 'integer' }
                },
                required: ['walletId', 'receiverAddress', 'tokenAddress', 'amountPerPeriod', 'intervalSeconds']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const body = request.body as {
            walletId: string,
            receiverAddress: string,
            tokenAddress: string,
            amountPerPeriod: string,
            intervalSeconds: number
        };

        try {
            const stream = await streamService.createStream(body);
            return stream;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to create stream', error: (error as Error).message });
        }
    });

    fastify.get('/streams', {
        schema: {
            tags: ['Streaming'],
            summary: 'List streams',
            querystring: {
                type: 'object',
                properties: {
                    walletId: { type: 'string' }
                }
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { walletId } = request.query as { walletId?: string };
        const streams = await streamService.listStreams(walletId);
        return streams;
    });

    fastify.delete('/streams/:id', {
        schema: {
            tags: ['Streaming'],
            summary: 'Cancel a stream',
            params: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            await streamService.cancelStream(id);
            return { message: 'Stream cancelled' };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to cancel stream' });
        }
    });
}

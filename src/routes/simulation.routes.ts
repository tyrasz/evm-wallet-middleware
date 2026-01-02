import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SimulationService } from '../services/simulation.service';
import { PolicyService } from '../services/policy.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';

export async function simulationRoutes(fastify: FastifyInstance) {
    const policyService = new PolicyService(fastify.prisma);
    const simulationService = new SimulationService(fastify.prisma, policyService);

    const simulationSchema = z.object({
        to: z.string().startsWith('0x'),
        value: z.string().optional(),
        data: z.string().optional(),
        walletId: z.string().uuid().optional(),
        from: z.string().startsWith('0x').optional(),
        checkPolicy: z.boolean().optional(),
    });

    fastify.post('/simulate', {
        preHandler: [authMiddleware, requireRole(UserRole.OPERATOR)],
        schema: {
            tags: ['Simulation'],
            summary: 'Simulate a transaction',
            body: {
                type: 'object',
                properties: {
                    to: { type: 'string' },
                    value: { type: 'string' },
                    data: { type: 'string' },
                    walletId: { type: 'string' },
                    from: { type: 'string' },
                    checkPolicy: { type: 'boolean' }
                },
                required: ['to']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        gasUsed: { type: 'string' },
                        returnData: { type: 'string' },
                        error: { type: 'string' },
                        policyStatus: { type: 'string' },
                        policyError: { type: 'string' }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const body = simulationSchema.parse(request.body);
            const { to, value, data, walletId, from, checkPolicy } = body;

            if (!walletId && !from) {
                return reply.status(400).send({ message: 'Either walletId or from address must be provided' });
            }

            const result = await simulationService.simulateTransaction({
                to,
                value,
                data,
                walletId: walletId || undefined,
                fromAddress: from,
                checkPolicy
            });
            return reply.send(result);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ message: 'Validation Error', error: error.message });
            }
            request.log.error(error);
            return reply.status(500).send({ message: 'Simulation failed', error: (error as Error).message });
        }
    });
}

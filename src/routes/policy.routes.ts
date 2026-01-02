import { FastifyInstance } from 'fastify';
import { PolicyService } from '../services/policy.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';

export default async function policyRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', authMiddleware);

    // Only Admins can manage policies
    fastify.addHook('preHandler', requireRole(UserRole.ADMIN));

    const policyService = new PolicyService(fastify.prisma);

    fastify.post('/policies', {
        schema: {
            tags: ['Policy'],
            summary: 'Create a new policy',
            body: {
                type: 'object',
                required: ['type', 'config', 'scope'],
                properties: {
                    type: { type: 'string', enum: ['TRANSACTION_LIMIT', 'WHITELIST'] },
                    config: { type: 'object' },
                    scope: { type: 'string', enum: ['GLOBAL', 'WALLET'] },
                    entityId: { type: 'string' } // Optional
                }
            }
        }
    }, async (request, reply) => {
        const { type, config, scope, entityId } = request.body as any;

        try {
            const policy = await fastify.prisma.policy.create({
                data: {
                    type,
                    config: JSON.stringify(config),
                    scope,
                    entityId: entityId || null // Ensure null if undefined
                }
            });

            return policy;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to create policy', error: (error as Error).message });
        }
    });

    fastify.get('/policies', {
        schema: {
            tags: ['Policy'],
            summary: 'List all policies',
            querystring: {
                type: 'object',
                properties: {
                    scope: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { scope } = request.query as any;

        return fastify.prisma.policy.findMany({
            where: {
                scope
            }
        });
    });

    fastify.delete('/policies/:id', {
        schema: {
            tags: ['Policy'],
            summary: 'Delete a policy'
        }
    }, async (request, reply) => {
        const { id } = request.params as any;

        await fastify.prisma.policy.delete({
            where: { id }
        });

        return { success: true };
    });
}

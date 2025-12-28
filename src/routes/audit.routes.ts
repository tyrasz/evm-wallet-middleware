import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';
import { AuditService } from '../services/audit.service';

export default async function auditRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', authMiddleware);

    const auditService = new AuditService(fastify.prisma);

    fastify.get('/audit-logs', {
        schema: {
            tags: ['Audit'],
            summary: 'Get audit logs',
            querystring: {
                type: 'object',
                properties: {
                    entity: { type: 'string' },
                    actor: { type: 'string' },
                    limit: { type: 'integer', default: 50 },
                    offset: { type: 'integer', default: 0 }
                }
            },
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            action: { type: 'string' },
                            entity: { type: 'string' },
                            entityId: { type: 'string' },
                            actor: { type: 'string' },
                            metadata: { type: 'string', nullable: true }, // Parsed manually if needed
                            status: { type: 'string' },
                            createdAt: { type: 'string' }
                        }
                    }
                }
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.ADMIN)
    }, async (request, reply) => {
        const { entity, actor, limit, offset } = request.query as {
            entity?: string;
            actor?: string;
            limit?: number;
            offset?: number;
        };

        const logs = await auditService.getLogs({ entity, actor, limit, offset });
        return logs.map(log => ({
            ...log,
            createdAt: log.createdAt.toISOString()
        }));
    });
}

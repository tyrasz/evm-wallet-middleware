import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

export default async function healthRoutes(fastify: FastifyInstance) {
    fastify.get('/health', {
        schema: {
            tags: ['Health'],
            summary: 'Health Check',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        timestamp: { type: 'string' },
                        database: { type: 'string' }
                    }
                },
                503: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        error: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            // Check DB connection
            await fastify.prisma.$queryRaw`SELECT 1`;

            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                database: 'connected'
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(503).send({
                status: 'error',
                error: 'Database unavailable'
            });
        }
    });
}

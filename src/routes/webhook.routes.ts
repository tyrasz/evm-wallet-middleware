import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WebhookService } from '../services/webhook.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';

export async function webhookRoutes(fastify: FastifyInstance) {
    const webhookService = new WebhookService(fastify.prisma);

    const createWebhookSchema = z.object({
        url: z.string().url(),
        events: z.array(z.string()).min(1),
        secret: z.string().optional()
    });

    // Apply strict admin only policy for creating webhooks for now
    fastify.addHook('preHandler', authMiddleware);

    fastify.post('/webhooks', {
        preHandler: requireRole(UserRole.ADMIN),
        schema: {
            tags: ['Webhooks'],
            summary: 'Register a webhook',
            body: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                    events: { type: 'array', items: { type: 'string' } },
                    secret: { type: 'string' }
                },
                required: ['url', 'events']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        url: { type: 'string' },
                        events: { type: 'string' } // JSON string in response or we can parse it? DB returns string
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const body = createWebhookSchema.parse(request.body);
            const webhook = await webhookService.createWebhook(body.url, body.events, body.secret);
            return webhook;
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ message: 'Validation Error', error: error.message });
            }
            return reply.status(500).send({ message: 'Failed to create webhook' });
        }
    });

    fastify.get('/webhooks', {
        preHandler: requireRole(UserRole.ADMIN),
        schema: {
            tags: ['Webhooks'],
            summary: 'List webhooks',
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            url: { type: 'string' },
                            events: { type: 'array', items: { type: 'string' } }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        return webhookService.listWebhooks();
    });

    fastify.delete('/webhooks/:id', {
        preHandler: requireRole(UserRole.ADMIN),
        schema: {
            tags: ['Webhooks'],
            summary: 'Delete a webhook',
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string' }
                },
                required: ['id']
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            await webhookService.deleteWebhook(id);
            return { success: true };
        } catch (error) {
            return reply.status(500).send({ message: 'Failed to delete webhook' });
        }
    });
}

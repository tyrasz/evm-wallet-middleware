import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DecoderService } from '../services/decoder.service';
import { authMiddleware } from '../middleware/auth.middleware';

export async function decoderRoutes(fastify: FastifyInstance) {
    const decoderService = new DecoderService();

    // Authenticated route, but available to all roles
    fastify.addHook('preHandler', authMiddleware);

    const decodeSchema = z.object({
        data: z.string().startsWith('0x'),
        to: z.string().optional() // Optional, useful for future logical decoding (e.g. proxy detection)
    });

    fastify.post('/decode', {
        schema: {
            tags: ['Decoding'],
            summary: 'Decode transaction calldata',
            body: {
                type: 'object',
                properties: {
                    data: { type: 'string' },
                    to: { type: 'string' }
                },
                required: ['data']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        args: { type: 'object', additionalProperties: true },
                        found: { type: 'boolean' }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const body = decodeSchema.parse(request.body);
            const result = decoderService.decodeData(body.data);

            if (!result) {
                return reply.send({ found: false });
            }

            return reply.send({
                found: true,
                name: result.name,
                args: result.args
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ message: 'Validation Error', error: error.message });
            }
            return reply.status(500).send({ message: 'Failed to decode' });
        }
    });
}

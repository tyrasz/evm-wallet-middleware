import { FastifyReply, FastifyRequest } from 'fastify';
import { authService, UserRole } from '../services/auth.service';

// Extend FastifyRequest to include user
declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            role: UserRole;
            apiKeyPrefix: string;
        };
    }
}

export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
        return reply.status(401).send({ message: 'Missing API Key' });
    }

    const result = await authService.validateApiKey(apiKey);

    if (!result) {
        return reply.status(401).send({ message: 'Invalid API Key' });
    }

    request.user = {
        role: result.role,
        apiKeyPrefix: result.prefix
    };
};

export const requireRole = (requiredRole: UserRole) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.user) {
            return reply.status(401).send({ message: 'Unauthorized' });
        }

        if (request.user.role !== requiredRole && request.user.role !== UserRole.ADMIN) {
            return reply.status(403).send({ message: 'Forbidden: Insufficient permissions' });
        }
    };
};

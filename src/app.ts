import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import prismaPlugin from './plugins/prisma';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import walletRoutes from './routes/wallet.routes';
import auditRoutes from './routes/audit.routes';
import policyRoutes from './routes/policy.routes';
import healthRoutes from './routes/health.routes';
import { simulationRoutes } from './routes/simulation.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { decoderRoutes } from './routes/decoder.routes';
import tokenRoutes from './routes/token.routes';
import { proposalRoutes } from './routes/proposal.routes';

export const buildApp = async () => {
    const app = Fastify({
        logger: {
            level: env.LOG_LEVEL,
        },
    });

    await app.register(rateLimit, {
        max: 100, // 100 requests per minute
        timeWindow: '1 minute',
        errorResponseBuilder: (request: any, context: any) => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${context.after} seconds.`,
        }),
    });

    await app.register(cors, {
        origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'x-api-key'],
    });

    // Register Plugins
    await app.register(prismaPlugin);

    // Seed Dev Key
    const { authService } = await import('./services/auth.service');
    await authService.seedDevKey();

    // Start Gas Monitor
    const { GasMonitorService } = await import('./services/gas-monitor.service');
    const { WebhookService } = await import('./services/webhook.service');
    const webhookService = new WebhookService(app.prisma);
    const gasMonitor = new GasMonitorService(app.prisma, webhookService);
    gasMonitor.start();

    await app.register(swagger, {
        swagger: {
            info: {
                title: 'EVM Wallet Middleware',
                description: 'Enterprise-grade EVM wallet management API',
                version: '1.0.0',
            },
            host: `localhost:${env.PORT}`,
            schemes: ['http'],
            consumes: ['application/json'],
            produces: ['application/json'],
        },
    });

    await app.register(swaggerUi, {
        routePrefix: '/documentation',
    });

    // Register Routes
    await app.register(walletRoutes, { prefix: '/api/v1' });
    await app.register(auditRoutes, { prefix: '/api/v1' });
    await app.register(policyRoutes, { prefix: '/api/v1' });
    await app.register(simulationRoutes, { prefix: '/api/v1' });
    await app.register(webhookRoutes, { prefix: '/api/v1' });
    await app.register(decoderRoutes, { prefix: '/api/v1' });
    await app.register(tokenRoutes, { prefix: '/api/v1' });
    await app.register(proposalRoutes, { prefix: '/api/v1' });
    await app.register(healthRoutes); // Root level /health

    return app;
};

const start = async () => {
    try {
        const app = await buildApp();
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
        console.log(`Server listening on http://localhost:${env.PORT}`);
        console.log(`Documentation available at http://localhost:${env.PORT}/documentation`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

if (require.main === module) {
    start();
}

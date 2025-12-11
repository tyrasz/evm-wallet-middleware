import Fastify from 'fastify';
import { env } from './config/env';
import prismaPlugin from './plugins/prisma';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import walletRoutes from './routes/wallet.routes';

export const buildApp = async () => {
    const app = Fastify({
        logger: {
            level: env.LOG_LEVEL,
        },
    });

    // Register Plugins
    await app.register(prismaPlugin);

    // Seed Dev Key
    const { authService } = await import('./services/auth.service');
    await authService.seedDevKey();

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

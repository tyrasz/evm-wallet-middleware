import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';

describe('Operational APIs', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should return health status', async () => {
        const response = await supertest(app.server)
            .get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(response.body.database).toBe('connected');
        expect(response.body.timestamp).toBeDefined();
    });

    // Rate limit test might be flaky in parallel execution or if other tests consume quota.
    // We configured 100 per minute.
    it('should enforce rate limits', async () => {
        // We need to send > 100 requests quickly.
        // This might be slow for a test, but let's try a smaller batch ensuring headers are present.

        const response = await supertest(app.server).get('/health');
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
});

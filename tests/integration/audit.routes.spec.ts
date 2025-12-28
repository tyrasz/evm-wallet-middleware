import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';

// Mock authService
vi.mock('../../src/services/auth.service', () => {
    return {
        authService: {
            validateApiKey: vi.fn().mockResolvedValue({ role: 'ADMIN', prefix: 'test-admin' }),
            seedDevKey: vi.fn(),
        },
        UserRole: {
            ADMIN: 'ADMIN',
            OPERATOR: 'OPERATOR'
        }
    };
});

describe('Audit API', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.clearAllMocks();
    });

    it('should create an audit log when creating a wallet and retrieve it', async () => {
        // 1. Create Wallet (Trigger Audit Log)
        const createResponse = await supertest(app.server)
            .post('/api/v1/wallets')
            .set('x-api-key', 'test-key')
            .send({ label: 'Audit Test Wallet' });

        expect(createResponse.status).toBe(200);

        // 2. Fetch Audit Logs
        const logsResponse = await supertest(app.server)
            .get('/api/v1/audit-logs')
            .set('x-api-key', 'test-key')
            .query({ limit: 1 });

        expect(logsResponse.status).toBe(200);
        expect(Array.isArray(logsResponse.body)).toBe(true);
        expect(logsResponse.body.length).toBeGreaterThan(0);

        const log = logsResponse.body[0];
        expect(log.action).toBe('WALLET_CREATE');
        expect(log.actor).toBe('test-admin');
        expect(log.entity).toBe('Wallet');
    });
});

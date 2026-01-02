import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';
import nock from 'nock';

// Mock authService
vi.mock('../../src/services/auth.service', () => {
    return {
        authService: {
            validateApiKey: vi.fn().mockImplementation(async (key) => {
                if (key === 'admin-key') return { role: 'ADMIN', prefix: 'test-admin' };
                if (key === 'operator-key') return { role: 'OPERATOR', prefix: 'operator' };
                return null;
            }),
            seedDevKey: vi.fn(),
        },
        UserRole: {
            ADMIN: 'ADMIN',
            OPERATOR: 'OPERATOR'
        }
    };
});

// Mock viem for WalletService
vi.mock('viem', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        createWalletClient: vi.fn().mockReturnValue({
            sendTransaction: vi.fn().mockImplementation(() => Promise.resolve(`0x${Math.random().toString(36).substring(2)}`)),
            signMessage: vi.fn().mockResolvedValue('0xsignature'),
        }),
    };
});

describe('Webhooks', () => {
    let app: FastifyInstance;
    let walletAddress: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        // Setup a wallet for transaction tests
        const walletRes = await supertest(app.server)
            .post('/api/v1/wallets')
            .set('x-api-key', 'admin-key')
            .send({ label: 'Webhook Test' });
        walletAddress = walletRes.body.address;
    });

    afterAll(async () => {
        await app.prisma.webhook.deleteMany();
        await app.close();
        vi.clearAllMocks();
        nock.cleanAll();
    });

    it('should create a webhook', async () => {
        const response = await supertest(app.server)
            .post('/api/v1/webhooks')
            .set('x-api-key', 'admin-key')
            .send({
                url: 'http://example.com/webhook',
                events: ['TRANSACTION_SUBMITTED']
            });

        expect(response.status).toBe(200);
        expect(response.body.url).toBe('http://example.com/webhook');
    });

    it('should list webhooks', async () => {
        const response = await supertest(app.server)
            .get('/api/v1/webhooks')
            .set('x-api-key', 'admin-key');

        expect(response.status).toBe(200);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0].events).toContain('TRANSACTION_SUBMITTED');
    });

    it('should trigger webhook on transaction submission', async () => {
        // Setup Nock to intercept the webhook request
        const scope = nock('http://example.com')
            .post('/webhook')
            .reply(200, { ok: true });

        // Trigger transaction
        await supertest(app.server)
            .post(`/api/v1/wallets/${walletAddress}/transactions`)
            .set('x-api-key', 'operator-key')
            .send({
                to: '0x1234567890123456789012345678901234567890',
                value: '0.1'
            });

        // Wait a small amount for the async dispatch
        await new Promise(resolve => setTimeout(resolve, 500));

        expect(scope.isDone()).toBe(true);
    });
});

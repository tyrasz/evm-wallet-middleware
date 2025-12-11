import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { FastifyInstance } from 'fastify';

// Mock chainService
vi.mock('../../src/services/chain.service', () => ({
    chainService: {
        getBalance: vi.fn(),
        getGasPrice: vi.fn(),
    },
}));

// Mock viem
vi.mock('viem', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as object,
        createWalletClient: vi.fn(() => ({
            sendTransaction: vi.fn().mockImplementation(() => Promise.resolve(`0x${Math.random().toString(16).slice(2)}`)),
        })),
    };
});

import { chainService } from '../../src/services/chain.service';

describe('Wallet API', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        vi.resetModules();

        vi.doMock('../../src/services/auth.service', () => {
            return {
                authService: {
                    validateApiKey: vi.fn().mockResolvedValue('ADMIN'),
                    seedDevKey: vi.fn(),
                },
                UserRole: {
                    ADMIN: 'ADMIN',
                    OPERATOR: 'OPERATOR'
                }
            };
        });

        const { buildApp } = await import('../../src/app');
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.clearAllMocks();
    });
    // ...
    it('should get a wallet by address with balance', async () => {
        // Setup mock
        vi.mocked(chainService.getBalance).mockResolvedValue('1.5');

        // Create first
        const createResponse = await supertest(app.server)
            .post('/api/v1/wallets')
            .set('x-api-key', 'test-key')
            .send({ label: 'Retrieval Test' });

        const address = createResponse.body.address;

        // Get
        const response = await supertest(app.server)
            .get(`/api/v1/wallets/${address}`)
            .set('x-api-key', 'test-key');

        expect(response.status).toBe(200);
        expect(response.body.address).toBe(address);
        expect(response.body.label).toBe('Retrieval Test');
        expect(response.body.balance).toBe('1.5');

        expect(chainService.getBalance).toHaveBeenCalledWith(address);
    });

    it('should return 404 for non-existent wallet', async () => {
        const response = await supertest(app.server)
            .get('/api/v1/wallets/0x1234567890123456789012345678901234567890')
            .set('x-api-key', 'test-key');

        expect(response.status).toBe(404);
    });

    it('should get wallet native balance', async () => {
        // Setup mock
        const address = '0x1234567890123456789012345678901234567890';
        vi.mocked(chainService.getBalance).mockResolvedValue('1.5');

        const response = await supertest(app.server)
            .get(`/api/v1/wallets/${address}/balance`)
            .set('x-api-key', 'test-key');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            balance: '1.5',
            symbol: 'ETH',
            decimals: 18
        });
    });

    it('should send a transaction', async () => {
        // Create wallet first
        const createResponse = await supertest(app.server)
            .post('/api/v1/wallets')
            .set('x-api-key', 'test-key')
            .send({ label: 'Test Wallet' });
        const address = createResponse.body.address;

        // Send tx
        const response = await supertest(app.server)
            .post(`/api/v1/wallets/${address}/transactions`)
            .set('x-api-key', 'test-key')
            .send({
                to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                value: '0.1'
            });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('SUBMITTED');
        expect(response.body.hash).toMatch(/^0x/);
        expect(response.body.from).toBe(address);
    });
});

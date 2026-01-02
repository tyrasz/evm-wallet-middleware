import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';

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

// Mock ChainService (viem)
// We need to mock the client retrieved by chainService.getClient()
// Since we invoke it inside simulationService, we can mock chainService entirely?
// Or mock the module.
vi.mock('../../src/services/chain.service', () => {
    return {
        chainService: {
            getClient: vi.fn().mockReturnValue({
                estimateGas: vi.fn().mockImplementation(async (args) => {
                    // Fail if value is very high (simulating revert/failure)
                    if (args.value && args.value.toString() === '1000000000000000000000') { // 1000 ETH
                        throw new Error('Insufficient funds for transfer');
                    }
                    return 21000n;
                }),
                call: vi.fn().mockResolvedValue({ data: '0x' }),
            })
        }
    };
});


describe('Transaction Simulation', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.clearAllMocks();
    });

    it('should simulate a valid transaction', async () => {
        const response = await supertest(app.server)
            .post('/api/v1/simulate')
            .set('x-api-key', 'admin-key')
            .send({
                to: '0x1234567890123456789012345678901234567890',
                value: '1.0', // 1 ETH
                from: '0xsender'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.gasUsed).toBe('21000');
    });

    it('should return error for failing transaction', async () => {
        const response = await supertest(app.server)
            .post('/api/v1/simulate')
            .set('x-api-key', 'admin-key')
            .send({
                to: '0x1234567890123456789012345678901234567890',
                value: '1000', // 1000 ETH -> Mock set to fail
                from: '0xsender'
            });

        // The service catches the error and returns success=false
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Insufficient funds');
    });

    it('should require walletId or from address', async () => {
        const response = await supertest(app.server)
            .post('/api/v1/simulate')
            .set('x-api-key', 'admin-key')
            .send({
                to: '0x1234567890123456789012345678901234567890'
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Either walletId or from address must be provided');
    });

    it('should block simulation if policy violation', async () => {
        // Create a policy first
        await supertest(app.server)
            .post('/api/v1/policies')
            .set('x-api-key', 'admin-key')
            .send({
                type: 'TRANSACTION_LIMIT',
                config: { maxAmount: '0.5' }, // Max 0.5 ETH
                scope: 'GLOBAL'
            });

        const response = await supertest(app.server)
            .post('/api/v1/simulate')
            .set('x-api-key', 'admin-key')
            .send({
                to: '0x1234567890123456789012345678901234567890',
                value: '1.0', // 1 ETH (Exceeds limit)
                from: '0xsender',
                checkPolicy: true
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(false);
        expect(response.body.policyStatus).toBe('REJECTED');
        expect(response.body.policyError).toContain('Policy Violation');
    });

    it('should allow simulation despite policy violation if checkPolicy is false', async () => {
        // Policy exists from previous test (Max 0.5 ETH)

        const response = await supertest(app.server)
            .post('/api/v1/simulate')
            .set('x-api-key', 'admin-key')
            .send({
                to: '0x1234567890123456789012345678901234567890',
                value: '1.0', // 1 ETH (Exceeds limit)
                from: '0xsender',
                checkPolicy: false // Default behavior
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.policyStatus).toBeUndefined();
    });
});

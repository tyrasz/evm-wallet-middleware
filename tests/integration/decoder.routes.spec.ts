import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { encodeFunctionData, parseAbi } from 'viem';

// Mock authService
vi.mock('../../src/services/auth.service', () => {
    return {
        authService: {
            validateApiKey: vi.fn().mockImplementation(async (key) => {
                if (key === 'admin-key') return { role: 'ADMIN', prefix: 'test-admin' };
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

// Avoid mocking chain service for this, we are testing the decoder logic which is pure

describe('Transaction Decoding', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.clearAllMocks();
    });

    it('should decode ERC20 transfer', async () => {
        const abi = parseAbi(['function transfer(address to, uint256 amount)']);
        const data = encodeFunctionData({
            abi,
            functionName: 'transfer',
            args: ['0x1234567890123456789012345678901234567890', 1000000000000000000n] // 1 ETH
        });

        const response = await supertest(app.server)
            .post('/api/v1/decode')
            .set('x-api-key', 'admin-key')
            .send({ data });

        expect(response.status).toBe(200);
        expect(response.body.found).toBe(true);
        expect(response.body.name).toBe('transfer');
        expect(response.body.args[0]).toBe('0x1234567890123456789012345678901234567890');
        expect(response.body.args[1]).toBe('1000000000000000000'); // Serialized BigInt
    });

    it('should return found: false for unknown calldata', async () => {
        const response = await supertest(app.server)
            .post('/api/v1/decode')
            .set('x-api-key', 'admin-key')
            .send({ data: '0x12345678' }); // Random garbage

        expect(response.status).toBe(200);
        expect(response.body.found).toBe(false);
    });
});

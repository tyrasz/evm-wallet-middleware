import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';

// Mock chainService
vi.mock('../../src/services/chain.service', () => ({
    chainService: {
        getBalance: vi.fn(),
        getGasPrice: vi.fn(),
        getClient: vi.fn(),
    },
}));

// Mock viem
vi.mock('viem', async (importOriginal) => {
    const actual = await importOriginal();
    const mockClient = {
        sendTransaction: vi.fn().mockImplementation(() => Promise.resolve(`0x${Math.random().toString(16).slice(2)}`)),
        writeContract: vi.fn().mockImplementation(() => Promise.resolve(`0x${Math.random().toString(16).slice(2)}`)),
        readContract: vi.fn().mockImplementation(({ functionName }) => {
            if (functionName === 'balanceOf') return Promise.resolve(10000000000000000000n); // 10 tokens
            if (functionName === 'symbol') return Promise.resolve('TEST');
            if (functionName === 'decimals') return Promise.resolve(18);
            return Promise.resolve(0n);
        }),
        signMessage: vi.fn().mockResolvedValue('0xsignature'),
    };

    // Update chainService mock to return this client
    const { chainService } = await import('../../src/services/chain.service');
    vi.mocked(chainService.getClient).mockReturnValue(mockClient as any);

    return {
        ...actual as object,
        createWalletClient: vi.fn(() => mockClient),
    };
});


// Mock authService
vi.mock('../../src/services/auth.service', () => {
    const mockValidate = vi.fn().mockResolvedValue('ADMIN');
    const mockSeed = vi.fn();
    return {
        authService: {
            validateApiKey: mockValidate,
            seedDevKey: mockSeed,
        },
        UserRole: {
            ADMIN: 'ADMIN',
            OPERATOR: 'OPERATOR'
        }
    };
});

describe('DeFi API', () => {
    let app: FastifyInstance;
    let walletAddress: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        // Create a wallet for testing
        const createResponse = await supertest(app.server)
            .post('/api/v1/wallets')
            .set('x-api-key', 'test-key')
            .send({ label: 'DeFi Test' });
        walletAddress = createResponse.body.address;
    });

    afterAll(async () => {
        await app.close();
        vi.clearAllMocks();
    });

    it('should get ERC20 token balance', async () => {
        const response = await supertest(app.server)
            .get(`/api/v1/wallets/${walletAddress}/erc20/balance`)
            .set('x-api-key', 'test-key')
            .query({ tokenAddress: '0xTokenAddress' });

        expect(response.status).toBe(200);
        expect(response.body.balance).toBe('10');
        expect(response.body.symbol).toBe('TEST');
        expect(response.body.decimals).toBe(18);
    });

    it('should transfer ERC20 tokens with validation', async () => {
        const response = await supertest(app.server)
            .post(`/api/v1/wallets/${walletAddress}/erc20/transfer`)
            .set('x-api-key', 'test-key')
            .send({
                tokenAddress: '0xTokenAddress',
                to: '0xRecipient',
                amount: '1',
                symbol: 'TEST'
            });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('SUBMITTED');
    });

    it('should fail transfer if symbol mismatch', async () => {
        const response = await supertest(app.server)
            .post(`/api/v1/wallets/${walletAddress}/erc20/transfer`)
            .set('x-api-key', 'test-key')
            .send({
                tokenAddress: '0xTokenAddress',
                to: '0xRecipient',
                amount: '1',
                symbol: 'WRONG'
            });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Token symbol mismatch');
    });

    it('should fail transfer if insufficient balance', async () => {
        const response = await supertest(app.server)
            .post(`/api/v1/wallets/${walletAddress}/erc20/transfer`)
            .set('x-api-key', 'test-key')
            .send({
                tokenAddress: '0xTokenAddress',
                to: '0xRecipient',
                amount: '100', // Has 10
                symbol: 'TEST'
            });

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Insufficient balance');
    });

    it('should sign a message', async () => {
        const response = await supertest(app.server)
            .post(`/api/v1/wallets/${walletAddress}/sign`)
            .set('x-api-key', 'test-key')
            .send({
                message: 'Hello World'
            });

        expect(response.status).toBe(200);
        expect(response.body.signature).toBe('0xsignature');
    });

    it('should call a smart contract', async () => {
        const response = await supertest(app.server)
            .post(`/api/v1/wallets/${walletAddress}/transactions/contract`)
            .set('x-api-key', 'test-key')
            .send({
                contractAddress: '0xContract',
                abi: [{ name: 'test', type: 'function' }],
                functionName: 'test',
                args: [],
                value: '0'
            });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('SUBMITTED');
        expect(response.body.hash).toMatch(/^0x/);
    });
});

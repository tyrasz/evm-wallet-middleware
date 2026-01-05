
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { StakingService } from '../../src/services/staking.service';

// Mock authService
vi.mock('../../src/services/auth.service', () => {
    return {
        authService: {
            validateApiKey: vi.fn().mockResolvedValue({ role: 'OPERATOR', prefix: 'test-admin' }),
            seedDevKey: vi.fn(),
        },
        UserRole: {
            ADMIN: 'ADMIN',
            OPERATOR: 'OPERATOR'
        }
    };
});

describe('Staking API', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.clearAllMocks();
    });

    it('should deposit assets', async () => {
        // Spy on StakingService.prototype.deposit
        const depositSpy = vi.spyOn(StakingService.prototype, 'deposit')
            .mockResolvedValue({ id: 'tx-123', status: 'SUBMITTED', hash: '0xhash' } as any);

        const response = await supertest(app.server)
            .post('/api/v1/wallets/wallet-123/staking/deposit')
            .set('x-api-key', 'test-key')
            .send({
                vaultAddress: '0x123',
                amount: '100'
            });

        expect(response.status).toBe(200);
        expect(response.body.id).toBe('tx-123');
        expect(depositSpy).toHaveBeenCalledWith('wallet-123', '0x123', '100');
    });

    it('should get position', async () => {
        const positionSpy = vi.spyOn(StakingService.prototype, 'getPosition')
            .mockResolvedValue({
                vaultAddress: '0x123',
                assetAddress: '0xasset',
                shares: '1000',
                assetValue: '1050',
                assetValueRaw: '1050000000'
            });

        const response = await supertest(app.server)
            .get('/api/v1/wallets/wallet-123/staking/0x123')
            .set('x-api-key', 'test-key');

        expect(response.status).toBe(200);
        expect(response.body.shares).toBe('1000');
        expect(positionSpy).toHaveBeenCalledWith('wallet-123', '0x123');
    });
});

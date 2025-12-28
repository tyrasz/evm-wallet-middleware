import { describe, it, expect, vi } from 'vitest';

// Mock the env config before importing the service
vi.mock('../../src/config/env', () => ({
    env: {
        MASTER_KEY: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    },
}));

import { CryptoService } from '../../src/services/crypto.service';

describe('CryptoService', () => {
    const cryptoService = new CryptoService();

    it('should encrypt and decrypt correctly', async () => {
        const originalText = 'my-secret-private-key';
        const { encryptedData, iv } = await cryptoService.encrypt(originalText);

        expect(encryptedData).not.toBe(originalText);
        expect(iv).toBeDefined();

        const decryptedText = await cryptoService.decrypt(encryptedData, iv);
        expect(decryptedText).toBe(originalText);
    });

    it('should produce different outputs for same input (random IV)', async () => {
        const text = 'same-text';
        const result1 = await cryptoService.encrypt(text);
        const result2 = await cryptoService.encrypt(text);

        expect(result1.encryptedData).not.toBe(result2.encryptedData);
        expect(result1.iv).not.toBe(result2.iv);
    });

    it('should fail if auth tag is modified', async () => {
        const text = 'sensitive-data';
        const { encryptedData, iv } = await cryptoService.encrypt(text);

        // Tamper with the last byte (part of auth tag)
        const tamperedData = encryptedData.slice(0, -2) + '00';

        await expect(async () => {
            await cryptoService.decrypt(tamperedData, iv);
        }).rejects.toThrow();
    });
});

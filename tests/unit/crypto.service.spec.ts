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

    it('should encrypt and decrypt correctly', () => {
        const originalText = 'my-secret-private-key';
        const { encryptedData, iv } = cryptoService.encrypt(originalText);

        expect(encryptedData).not.toBe(originalText);
        expect(iv).toBeDefined();

        const decryptedText = cryptoService.decrypt(encryptedData, iv);
        expect(decryptedText).toBe(originalText);
    });

    it('should produce different outputs for same input (random IV)', () => {
        const text = 'same-text';
        const result1 = cryptoService.encrypt(text);
        const result2 = cryptoService.encrypt(text);

        expect(result1.encryptedData).not.toBe(result2.encryptedData);
        expect(result1.iv).not.toBe(result2.iv);
    });

    it('should fail if auth tag is modified', () => {
        const text = 'sensitive-data';
        const { encryptedData, iv } = cryptoService.encrypt(text);

        // Tamper with the last byte (part of auth tag)
        const tamperedData = encryptedData.slice(0, -2) + '00';

        expect(() => {
            cryptoService.decrypt(tamperedData, iv);
        }).toThrow();
    });
});

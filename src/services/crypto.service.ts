import { KeyManager } from '../interfaces/key-manager.interface';
import { LocalKeyManager } from './key-manager/local-key-manager';

export class CryptoService {
    private keyManager: KeyManager;

    constructor(keyManager?: KeyManager) {
        this.keyManager = keyManager || new LocalKeyManager();
    }

    // Allow injection (e.g., for testing or switching implementation)
    setKeyManager(keyManager: KeyManager) {
        this.keyManager = keyManager;
    }

    // Synchronous wrappers are no longer possible if underlying KeyManager is async (which KMS usually is).
    // HOWEVER, for now, LocalKeyManager is async but we need to check if existing code expects sync.
    // Checking existing code... it uses `cryptoService.decrypt` synchronously in `wallet.service.ts`.
    // We MUST update call sites to await the result. 
    // Wait, the interface I defined earlier has async methods. 
    // I need to update `LocalKeyManager` to be async compliant, and update all consumers.

    async encrypt(text: string): Promise<{ encryptedData: string; iv: string }> {
        return this.keyManager.encrypt(text);
    }

    async decrypt(encryptedData: string, ivHex: string): Promise<string> {
        return this.keyManager.decrypt(encryptedData, ivHex);
    }
}

export const cryptoService = new CryptoService();

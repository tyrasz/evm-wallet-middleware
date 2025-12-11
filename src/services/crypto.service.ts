import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';

export class CryptoService {
    private readonly masterKey: Buffer;

    constructor() {
        this.masterKey = Buffer.from(env.MASTER_KEY, 'hex');
    }

    encrypt(text: string): { encryptedData: string; iv: string } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // We append the auth tag to the encrypted data for storage convenience, 
        // or return it separately. Here we'll append it to the encrypted string 
        // but typically GCM requires it for decryption.
        // Let's return it as part of the encrypted string: encrypted + authTag

        return {
            encryptedData: encrypted + authTag.toString('hex'),
            iv: iv.toString('hex'),
        };
    }

    decrypt(encryptedData: string, ivHex: string): string {
        const iv = Buffer.from(ivHex, 'hex');

        // Extract auth tag (last 16 bytes = 32 hex chars)
        const authTagLengthHex = 32;
        const authTagHex = encryptedData.slice(-authTagLengthHex);
        const encryptedText = encryptedData.slice(0, -authTagLengthHex);

        const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

export const cryptoService = new CryptoService();

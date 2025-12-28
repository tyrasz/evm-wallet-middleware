export interface KeyManager {
    encrypt(text: string): Promise<{ encryptedData: string; iv: string }>;
    decrypt(encryptedData: string, iv: string): Promise<string>;
}

import { createPublicClient, http, formatEther, parseEther, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { env } from '../config/env';

export class ChainService {
    private client: PublicClient;

    constructor() {
        this.client = createPublicClient({
            chain: sepolia,
            transport: http(env.RPC_URL_SEPOLIA),
        });
    }

    async getBalance(address: string): Promise<string> {
        const balance = await this.client.getBalance({
            address: address as `0x${string}`,
        });
        return formatEther(balance);
    }

    async getGasPrice(): Promise<string> {
        const price = await this.client.getGasPrice();
        return price.toString();
    }

    async sendTransaction(signedTx: string): Promise<string> {
        const hash = await this.client.sendRawTransaction({
            serializedTransaction: signedTx as `0x${string}`,
        });
        return hash;
    }

    // Helper to get client for advanced usage
    getClient() {
        return this.client;
    }
}

export const chainService = new ChainService();

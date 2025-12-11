import { PrismaClient } from '@prisma/client';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, parseEther, encodeFunctionData, Hex, getAddress, formatUnits, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { env } from '../config/env';
import { cryptoService } from './crypto.service';
import { chainService } from './chain.service';

const ERC20_ABI = [
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }]
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }]
    }
] as const;

export class WalletService {
    constructor(private prisma: PrismaClient) { }

    async createWallet(label?: string) {
        // 1. Generate private key
        const privateKey = generatePrivateKey();
        const account = privateKeyToAccount(privateKey);

        // 2. Encrypt private key
        const { encryptedData, iv } = cryptoService.encrypt(privateKey);

        // 3. Store in DB
        const wallet = await this.prisma.wallet.create({
            data: {
                address: account.address,
                encryptedPrivateKey: encryptedData,
                iv: iv,
                label,
            },
        });

        // Return public info only
        return {
            id: wallet.id,
            address: wallet.address,
            label: wallet.label,
            createdAt: wallet.createdAt,
        };
    }

    async getWallet(address: string) {
        const wallet = await this.prisma.wallet.findUnique({
            where: { address },
        });

        if (!wallet) return null;

        return {
            id: wallet.id,
            address: wallet.address,
            label: wallet.label,
            createdAt: wallet.createdAt,
        };
    }

    // Internal method to get signer (requires decryption)
    async getSigner(address: string) {
        // Normalize address to checksum format to ensure database match
        const checksumAddress = getAddress(address);

        const wallet = await this.prisma.wallet.findUnique({
            where: { address: checksumAddress },
        });

        if (!wallet) throw new Error(`Wallet not found: ${address} (normalized: ${checksumAddress})`);

        const privateKey = cryptoService.decrypt(wallet.encryptedPrivateKey, wallet.iv);
        // Ensure it has 0x prefix for viem
        const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

        return privateKeyToAccount(formattedKey as `0x${string}`);
    }

    async sendTransaction(fromAddress: string, toAddress: string, value: string) {
        const account = await this.getSigner(fromAddress);

        // Create transaction record
        const transaction = await this.prisma.transaction.create({
            data: {
                from: fromAddress,
                to: toAddress,
                value,
                chainId: 11155111, // Sepolia
                status: 'PENDING',
                wallet: { connect: { address: fromAddress } },
            },
        });

        try {
            const client = createWalletClient({
                account,
                chain: sepolia,
                transport: http(env.RPC_URL_SEPOLIA),
            });

            const hash = await client.sendTransaction({
                to: toAddress as `0x${string}`,
                value: parseEther(value),
            });

            const updated = await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'SUBMITTED',
                    hash: hash,
                },
            });

            return updated;
        } catch (error) {
            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: 'FAILED' },
            });
            throw error;
        }
    }

    async getERC20TokenInfo(walletAddress: string, tokenAddress: string) {
        // We don't need a signer for reading, just a public client would do, 
        // but we can use the wallet client or chain service.
        // Let's use chainService's client if we can access it, or create a new public client.
        // Since we are in WalletService, let's create a public client or use chainService.
        // We haven't injected ChainService, but we can import it or create a client.
        // Let's create a client for simplicity here as we did in other methods, 
        // or better, use `chainService.getClient()` if we import it.
        // We imported `sepolia` and `http`, so we can create a public client.

        // const { createPublicClient } = require('viem'); // Dynamic import or add to top? 
        // Let's add to top imports. I'll assume I added it or I'll use the one from chainService if I import it.
        // Actually, I can just use `createWalletClient` to read? No, `publicClient` is better.
        // Let's use `createPublicClient` from viem. I need to add it to imports.
        // I will add it to the import list in the first chunk.

        // Actually, let's just use the `chainService` pattern if possible.
        // But for now, I will use `createPublicClient` which I will add to imports.

        // Wait, I can't add `createPublicClient` to imports in the first chunk easily if I didn't include it.
        // I'll use `chainService` from `../services/chain.service`.
        const client = chainService.getClient();

        const [balance, symbol, decimals] = await Promise.all([
            client.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [walletAddress as `0x${string}`]
            }),
            client.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'symbol',
            }),
            client.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'decimals',
            })
        ]);

        return {
            balance: formatUnits(balance as bigint, decimals as number),
            symbol: symbol as string,
            decimals: decimals as number
        };
    }

    async getBalance(address: string) {
        return chainService.getBalance(address);
    }

    async transferERC20(fromAddress: string, tokenAddress: string, toAddress: string, amount: string, expectedSymbol?: string) {
        const account = await this.getSigner(fromAddress);

        // Validation
        const tokenInfo = await this.getERC20TokenInfo(fromAddress, tokenAddress);

        if (expectedSymbol && tokenInfo.symbol !== expectedSymbol) {
            throw new Error(`Token symbol mismatch. Expected ${expectedSymbol}, got ${tokenInfo.symbol}`);
        }

        if (parseFloat(tokenInfo.balance) < parseFloat(amount)) {
            throw new Error(`Insufficient balance. Has ${tokenInfo.balance} ${tokenInfo.symbol}, needed ${amount}`);
        }

        // We treat this as a generic transaction in DB for now, or we could add a type
        // For simplicity, we just log it as a transaction with 0 value (ETH) but we might want to store metadata
        const transaction = await this.prisma.transaction.create({
            data: {
                from: fromAddress,
                to: tokenAddress, // Interaction with token contract
                value: '0',
                chainId: 11155111,
                status: 'PENDING',
                wallet: { connect: { address: fromAddress } },
            },
        });

        try {
            const client = createWalletClient({
                account,
                chain: sepolia,
                transport: http(env.RPC_URL_SEPOLIA),
            });

            const hash = await client.writeContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [toAddress as `0x${string}`, parseUnits(amount, tokenInfo.decimals)],
            });

            const updated = await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'SUBMITTED',
                    hash: hash,
                },
            });

            return updated;
        } catch (error) {
            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: 'FAILED' },
            });
            throw error;
        }
    }

    async signMessage(address: string, message: string) {
        const account = await this.getSigner(address);
        const client = createWalletClient({
            account,
            chain: sepolia,
            transport: http(env.RPC_URL_SEPOLIA),
        });

        return client.signMessage({ message });
    }

    async callContract(fromAddress: string, contractAddress: string, abi: any[], functionName: string, args: any[], value: string = '0') {
        const account = await this.getSigner(fromAddress);

        const transaction = await this.prisma.transaction.create({
            data: {
                from: fromAddress,
                to: contractAddress,
                value,
                chainId: 11155111,
                status: 'PENDING',
                wallet: { connect: { address: fromAddress } },
            },
        });

        try {
            const client = createWalletClient({
                account,
                chain: sepolia,
                transport: http(env.RPC_URL_SEPOLIA),
            });

            const hash = await client.writeContract({
                address: contractAddress as `0x${string}`,
                abi,
                functionName,
                args,
                value: parseEther(value),
            });

            const updated = await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'SUBMITTED',
                    hash: hash,
                },
            });

            return updated;
        } catch (error) {
            await this.prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: 'FAILED' },
            });
            throw error;
        }
    }
}

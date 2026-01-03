
import { PrismaClient } from '@prisma/client';
import { chainService } from './chain.service';
import { getAddress } from 'viem';

// Basic ERC20 ABI for Metadata
const ERC20_METADATA_ABI = [
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

export class TokenService {
    constructor(private prisma: PrismaClient) { }

    async addToken(walletId: string, tokenAddress: string, chainId: number = 11155111) {
        const checksumAddress = getAddress(tokenAddress);

        // 1. Check if token exists in global registry
        let token = await this.prisma.token.findUnique({
            where: { address: checksumAddress }
        });

        // 2. If not, fetch metadata and create
        if (!token) {
            const client = chainService.getClient();
            const [symbol, decimals] = await Promise.all([
                client.readContract({ address: checksumAddress, abi: ERC20_METADATA_ABI, functionName: 'symbol' }),
                client.readContract({ address: checksumAddress, abi: ERC20_METADATA_ABI, functionName: 'decimals' })
            ]);

            token = await this.prisma.token.create({
                data: {
                    address: checksumAddress,
                    symbol: symbol as string,
                    decimals: decimals as number,
                    chainId
                }
            });
        }

        // 3. Link to Wallet (Ignore if already linked)
        // using upsert or create with distinct check. 
        // createMany not supported for sqlite in nested writes consistently? 
        // Let's use simple create and catch error, or findFirst.

        const existingLink = await this.prisma.walletToken.findUnique({
            where: {
                walletId_tokenId: {
                    walletId,
                    tokenId: token.id
                }
            }
        });

        if (!existingLink) {
            await this.prisma.walletToken.create({
                data: {
                    walletId,
                    tokenId: token.id
                }
            });
        }

        return token;
    }

    async removeToken(walletId: string, tokenAddress: string) {
        const checksumAddress = getAddress(tokenAddress);

        const token = await this.prisma.token.findUnique({
            where: { address: checksumAddress }
        });

        if (!token) return;

        await this.prisma.walletToken.delete({
            where: {
                walletId_tokenId: {
                    walletId,
                    tokenId: token.id
                }
            }
        });
    }

    async listTokens(walletId: string) {
        const wallet = await this.prisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                tokens: {
                    include: { token: true }
                }
            }
        });

        if (!wallet) throw new Error("Wallet not found");

        const client = chainService.getClient();

        // Fetch balances for all tokens
        // Explicitly cast to any to avoid stale type errors with Prisma relations
        const results = await Promise.all((wallet as any).tokens.map(async (wt: any) => {
            const t = wt.token;
            try {
                const balance = await client.readContract({
                    address: t.address as `0x${string}`,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [wallet.address as `0x${string}`]
                });

                // manual format since we have decimals
                const formatted = (Number(balance) / Math.pow(10, t.decimals)).toString();

                return {
                    ...t,
                    balance: formatted
                };
            } catch (e) {
                return { ...t, balance: '0' };
            }
        }));

        return results;
    }
}

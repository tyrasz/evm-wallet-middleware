
import { PrismaClient } from '@prisma/client';
import { chainService } from './chain.service';
import { WalletService } from './wallet.service';
import { getAddress, parseUnits, formatUnits } from 'viem';

// ERC4626 Minimal ABI
const ERC4626_ABI = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'assets', type: 'uint256' },
            { name: 'receiver', type: 'address' }
        ],
        outputs: [{ name: 'shares', type: 'uint256' }]
    },
    {
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'assets', type: 'uint256' },
            { name: 'receiver', type: 'address' },
            { name: 'owner', type: 'address' }
        ],
        outputs: [{ name: 'shares', type: 'uint256' }]
    },
    {
        name: 'asset',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: 'assetTokenAddress', type: 'address' }]
    },
    {
        name: 'totalAssets',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: 'totalManagedAssets', type: 'uint256' }]
    },
    {
        name: 'convertToShares',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'assets', type: 'uint256' }],
        outputs: [{ name: 'shares', type: 'uint256' }]
    },
    {
        name: 'convertToAssets',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'shares', type: 'uint256' }],
        outputs: [{ name: 'assets', type: 'uint256' }]
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: 'balance', type: 'uint256' }]
    },
    {
        name: 'previewDeposit',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'assets', type: 'uint256' }],
        outputs: [{ name: '', type: 'uint256' }]
    }
] as const;

const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    }
] as const;

export class StakingService {
    constructor(
        private prisma: PrismaClient,
        private walletService: WalletService
    ) { }

    async deposit(walletId: string, vaultAddress: string, amount: string) {
        const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
        if (!wallet) throw new Error('Wallet not found');

        const checksumVault = getAddress(vaultAddress);
        const client = chainService.getClient();

        // 1. Get Asset Address from Vault
        const assetAddress = await client.readContract({
            address: checksumVault,
            abi: ERC4626_ABI,
            functionName: 'asset'
        });

        // 2. Get Asset Decimals (Reuse TokenService logic or just assume/fetch)
        // For simplicity, we fetch decimals of asset
        const decimals = await this.getDecimals(assetAddress);
        const amountBigInt = parseUnits(amount, decimals);

        // 3. Approve Vault to spend Asset
        // Note: In a real app we might want to check allowance first
        await this.walletService.callContract(
            wallet.address,
            assetAddress,
            ERC20_ABI as any,
            'approve',
            [checksumVault, amountBigInt]
        );

        // 4. Deposit
        // Receiver is self
        const tx = await this.walletService.callContract(
            wallet.address,
            checksumVault,
            ERC4626_ABI as any,
            'deposit',
            [amountBigInt, wallet.address]
        );

        return tx;
    }

    async withdraw(walletId: string, vaultAddress: string, amount: string) {
        const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
        if (!wallet) throw new Error('Wallet not found');

        const checksumVault = getAddress(vaultAddress);
        const client = chainService.getClient();
        const assetAddress = await client.readContract({
            address: checksumVault,
            abi: ERC4626_ABI,
            functionName: 'asset'
        });
        const decimals = await this.getDecimals(assetAddress);
        const amountBigInt = parseUnits(amount, decimals); // Amount of underlying to withdraw

        // Withdraw relies on 'assets' input in standard 4626 withdraw fn: withdraw(assets, receiver, owner)
        const tx = await this.walletService.callContract(
            wallet.address,
            checksumVault,
            ERC4626_ABI as any,
            'withdraw',
            [amountBigInt, wallet.address, wallet.address]
        );

        return tx;
    }

    async getPosition(walletId: string, vaultAddress: string) {
        const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
        if (!wallet) throw new Error('Wallet not found');

        const checksumVault = getAddress(vaultAddress);
        const client = chainService.getClient();

        const [sharesBalance, totalAssets, totalShares] = await Promise.all([
            client.readContract({
                address: checksumVault,
                abi: ERC4626_ABI,
                functionName: 'balanceOf',
                args: [wallet.address as `0x${string}`]
            }),
            client.readContract({
                address: checksumVault,
                abi: ERC4626_ABI,
                functionName: 'totalAssets'
            }),
            // convertToAssets is better to estimate current value
            client.readContract({
                address: checksumVault,
                abi: ERC4626_ABI,
                functionName: 'convertToAssets',
                args: [parseUnits('1', 0)] // We need to pass shares, but wait... 
                // We want to convert USER shares.
            })
        ]);

        // Correct way to get user asset value
        const userAssets = await client.readContract({
            address: checksumVault,
            abi: ERC4626_ABI,
            functionName: 'convertToAssets',
            args: [sharesBalance]
        });

        const assetAddress = await client.readContract({
            address: checksumVault,
            abi: ERC4626_ABI,
            functionName: 'asset'
        });
        const decimals = await this.getDecimals(assetAddress);

        return {
            vaultAddress: checksumVault,
            assetAddress,
            shares: sharesBalance.toString(),
            assetValue: formatUnits(userAssets, decimals),
            assetValueRaw: userAssets.toString()
        };
    }

    private async getDecimals(tokenAddress: string): Promise<number> {
        const client = chainService.getClient();
        const decimals = await client.readContract({
            address: tokenAddress as `0x${string}`,
            abi: [{ name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' }] as const,
            functionName: 'decimals'
        });
        return decimals;
    }
}

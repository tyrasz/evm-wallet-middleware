import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WalletService } from '../services/wallet.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';
import { chainService } from '../services/chain.service';

import { AuditService } from '../services/audit.service';
import { PolicyService } from '../services/policy.service';
import { WebhookService } from '../services/webhook.service';

export default async function walletRoutes(fastify: FastifyInstance) {
    // Apply global auth middleware to all routes in this plugin
    fastify.addHook('preHandler', authMiddleware);

    const auditService = new AuditService(fastify.prisma);
    const policyService = new PolicyService(fastify.prisma);
    const webhookService = new WebhookService(fastify.prisma);
    const walletService = new WalletService(fastify.prisma, auditService, policyService, webhookService);

    const createWalletSchema = z.object({
        label: z.string().optional(),
    });

    fastify.post('/wallets', {
        schema: {
            tags: ['Wallets'],
            summary: 'Create a new wallet',
            body: {
                type: 'object',
                properties: {
                    label: { type: 'string' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        address: { type: 'string' },
                        label: { type: 'string', nullable: true },
                        createdAt: { type: 'string' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const body = createWalletSchema.parse(request.body);
        const actor = request.user?.apiKeyPrefix;
        const wallet = await walletService.createWallet(body.label, actor);
        return {
            ...wallet,
            createdAt: wallet.createdAt.toISOString(),
        };
    });

    fastify.get('/wallets', {
        schema: {
            tags: ['Wallets'],
            summary: 'List all wallets',
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            address: { type: 'string' },
                            label: { type: 'string', nullable: true },
                            createdAt: { type: 'string' }
                        }
                    }
                }
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const wallets = await walletService.listWallets();
        return wallets.map(w => ({
            ...w,
            createdAt: w.createdAt.toISOString()
        }));
    });

    fastify.get('/wallets/:address', {
        schema: {
            tags: ['Wallets'],
            summary: 'Get wallet by address',
            params: {
                type: 'object',
                properties: {
                    address: { type: 'string' }
                },
                required: ['address']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        address: { type: 'string' },
                        label: { type: 'string', nullable: true },
                        createdAt: { type: 'string' },
                        balance: { type: 'string' }
                    }
                },
                404: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                }
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { address } = request.params as { address: string };
        const wallet = await walletService.getWallet(address);

        if (!wallet) {
            return reply.status(404).send({ message: 'Wallet not found' });
        }

        let balance = '0';
        try {
            balance = await walletService.getBalance(address);
        } catch (error) {
            request.log.error(error, 'Failed to fetch balance');
        }

        return {
            ...wallet,
            createdAt: wallet.createdAt.toISOString(),
            balance,
        };
    });

    fastify.get('/wallets/:address/balance', {
        schema: {
            tags: ['Wallets'],
            summary: 'Get wallet native token balance',
            params: {
                type: 'object',
                properties: {
                    address: { type: 'string' }
                },
                required: ['address']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        balance: { type: 'string' },
                        symbol: { type: 'string' },
                        decimals: { type: 'number' }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' }
                    }
                }
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { address } = request.params as { address: string };

        try {
            const balance = await walletService.getBalance(address);
            return {
                balance,
                symbol: 'ETH', // Default for now, could be dynamic based on chain
                decimals: 18
            };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to fetch balance' });
        }
    });
    fastify.post('/wallets/:address/transactions', {
        schema: {
            tags: ['Wallets'],
            summary: 'Send a transaction',
            params: {
                type: 'object',
                properties: {
                    address: { type: 'string' }
                },
                required: ['address']
            },
            body: {
                type: 'object',
                properties: {
                    to: { type: 'string' },
                    value: { type: 'string' }
                },
                required: ['to', 'value']
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        hash: { type: 'string', nullable: true },
                        status: { type: 'string' },
                        from: { type: 'string' },
                        to: { type: 'string' },
                        value: { type: 'string' }
                    }
                }
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { address } = request.params as { address: string };
        const { to, value } = request.body as { to: string; value: string };
        const actor = request.user?.apiKeyPrefix;

        try {
            const tx = await walletService.sendTransaction(address, to, value, actor);
            return tx;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Transaction failed', error: (error as Error).message });
        }
    });


    fastify.get('/wallets/:address/erc20/balance', {
        schema: {
            tags: ['Wallets'],
            summary: 'Get ERC20 token balance',
            params: {
                type: 'object',
                properties: {
                    address: { type: 'string' }
                },
                required: ['address']
            },
            querystring: {
                type: 'object',
                properties: {
                    tokenAddress: { type: 'string' }
                },
                required: ['tokenAddress']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { address } = request.params as { address: string };
        const { tokenAddress } = request.query as { tokenAddress: string };

        try {
            const info = await walletService.getERC20TokenInfo(address, tokenAddress);
            return info;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Failed to fetch token info', error: (error as Error).message });
        }
    });

    fastify.post('/wallets/:address/erc20/transfer', {
        schema: {
            tags: ['Wallets'],
            summary: 'Transfer ERC20 tokens',
            params: {
                type: 'object',
                properties: {
                    address: { type: 'string' }
                },
                required: ['address']
            },
            body: {
                type: 'object',
                properties: {
                    tokenAddress: { type: 'string' },
                    to: { type: 'string' },
                    amount: { type: 'string' },
                    symbol: { type: 'string' }
                },
                required: ['tokenAddress', 'to', 'amount', 'symbol']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { address } = request.params as { address: string };
        const { tokenAddress, to, amount, symbol } = request.body as { tokenAddress: string; to: string; amount: string; symbol: string };

        try {
            const tx = await walletService.transferERC20(address, tokenAddress, to, amount, symbol);
            return tx;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'ERC20 Transfer failed', error: (error as Error).message });
        }
    });

    fastify.post('/wallets/:address/sign', {
        schema: {
            tags: ['Wallets'],
            summary: 'Sign a message',
            params: {
                type: 'object',
                properties: {
                    address: { type: 'string' }
                },
                required: ['address']
            },
            body: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
                required: ['message']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { address } = request.params as { address: string };
        const { message } = request.body as { message: string };

        try {
            const signature = await walletService.signMessage(address, message);
            return { signature };
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Signing failed' });
        }
    });

    fastify.post('/wallets/:address/transactions/contract', {
        schema: {
            tags: ['Wallets'],
            summary: 'Call a smart contract',
            params: {
                type: 'object',
                properties: {
                    address: { type: 'string' }
                },
                required: ['address']
            },
            body: {
                type: 'object',
                properties: {
                    contractAddress: { type: 'string' },
                    abi: { type: 'array' },
                    functionName: { type: 'string' },
                    args: { type: 'array' },
                    value: { type: 'string' }
                },
                required: ['contractAddress', 'abi', 'functionName', 'args']
            },
            security: [{ apiKey: [] }]
        },
        preHandler: requireRole(UserRole.OPERATOR)
    }, async (request, reply) => {
        const { address } = request.params as { address: string };
        const { contractAddress, abi, functionName, args, value } = request.body as {
            contractAddress: string;
            abi: any[];
            functionName: string;
            args: any[];
            value?: string;
        };

        try {
            const tx = await walletService.callContract(address, contractAddress, abi, functionName, args, value);
            return tx;
        } catch (error) {
            request.log.error(error);
            return reply.status(500).send({ message: 'Contract call failed' });
        }
    });
}

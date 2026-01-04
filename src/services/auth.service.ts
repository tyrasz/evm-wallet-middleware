import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { env } from '../config/env';

const prisma = new PrismaClient();

export enum UserRole {
    ADMIN = 'ADMIN',
    OPERATOR = 'OPERATOR',
    MAKER = 'MAKER',
    CHECKER = 'CHECKER'
}

export class AuthService {
    private static instance: AuthService;

    private constructor() { }

    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    /**
     * Generates a new API Key, stores the hash, and returns the raw key.
     * The raw key is NEVER stored.
     */
    async generateApiKey(role: UserRole, description?: string): Promise<string> {
        const rawKey = crypto.randomBytes(32).toString('hex');
        const hash = this.hashKey(rawKey);
        const prefix = rawKey.substring(0, 8);

        await prisma.apiKey.create({
            data: {
                keyHash: hash,
                prefix: prefix,
                role: role,
                description: description
            }
        });

        return rawKey;
    }

    /**
     * Validates an API Key and returns the role and prefix if valid.
     */
    async validateApiKey(rawKey: string): Promise<{ role: UserRole, prefix: string } | null> {
        const hash = this.hashKey(rawKey);

        const apiKey = await prisma.apiKey.findUnique({
            where: { keyHash: hash }
        });

        if (!apiKey) return null;

        // Update last used asynchronously
        prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() }
        }).catch(err => console.error('Failed to update lastUsedAt', err));

        return {
            role: apiKey.role as UserRole,
            prefix: apiKey.prefix
        };
    }

    /**
     * Seeds a development admin key if it doesn't exist.
     * ONLY for development/test environments.
     */
    async seedDevKey() {
        if (env.NODE_ENV === 'production') return;

        const devKey = 'dev-admin-key';
        const hash = this.hashKey(devKey);

        const exists = await prisma.apiKey.findUnique({ where: { keyHash: hash } });

        if (!exists) {
            console.log('🌱 Seeding development admin key: dev-admin-key');
            await prisma.apiKey.create({
                data: {
                    keyHash: hash,
                    prefix: devKey.substring(0, 8),
                    role: UserRole.ADMIN,
                    description: 'Auto-seeded development key'
                }
            });
        }

        // Seed Maker Key
        const makerKey = 'dev-maker-key';
        const makerHash = this.hashKey(makerKey);
        if (!(await prisma.apiKey.findUnique({ where: { keyHash: makerHash } }))) {
            console.log('🌱 Seeding development maker key: dev-maker-key');
            await prisma.apiKey.create({
                data: {
                    keyHash: makerHash,
                    prefix: makerKey.substring(0, 8),
                    role: UserRole.MAKER,
                    description: 'Auto-seeded maker key'
                }
            });
        }

        // Seed Checker Key
        const checkerKey = 'dev-checker-key';
        const checkerHash = this.hashKey(checkerKey);
        if (!(await prisma.apiKey.findUnique({ where: { keyHash: checkerHash } }))) {
            console.log('🌱 Seeding development checker key: dev-checker-key');
            await prisma.apiKey.create({
                data: {
                    keyHash: checkerHash,
                    prefix: checkerKey.substring(0, 8),
                    role: UserRole.CHECKER,
                    description: 'Auto-seeded checker key'
                }
            });
        }
    }

    private hashKey(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }
}

export const authService = AuthService.getInstance();

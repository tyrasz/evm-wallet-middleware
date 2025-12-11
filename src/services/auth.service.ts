import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { env } from '../config/env';

const prisma = new PrismaClient();

export enum UserRole {
    ADMIN = 'ADMIN',
    OPERATOR = 'OPERATOR'
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
     * Validates an API Key and returns the role if valid.
     */
    async validateApiKey(rawKey: string): Promise<UserRole | null> {
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

        return apiKey.role as UserRole;
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
    }

    private hashKey(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }
}

export const authService = AuthService.getInstance();

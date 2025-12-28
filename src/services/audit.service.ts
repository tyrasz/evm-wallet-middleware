import { PrismaClient } from '@prisma/client';

export class AuditService {
    constructor(private prisma: PrismaClient) { }

    async log(
        action: string,
        entity: string,
        entityId: string,
        actor: string, // API Key Prefix or User ID
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string,
        status: 'SUCCESS' | 'FAILURE' = 'SUCCESS'
    ) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    action,
                    entity,
                    entityId,
                    actor,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    ipAddress,
                    userAgent,
                    status,
                },
            });
        } catch (error) {
            // Failsafe: Audit logging failing should not crash the application, 
            // but in a strict SOC2 environment, we might want to alert here.
            console.error('Failed to write audit log:', error);
        }
    }

    async getLogs(filter?: { entity?: string; actor?: string; limit?: number; offset?: number }) {
        const { entity, actor, limit = 50, offset = 0 } = filter || {};

        return this.prisma.auditLog.findMany({
            where: {
                entity,
                actor: actor ? { contains: actor } : undefined,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
            skip: offset,
        });
    }
}

// We will inject the prisma instance when initializing elsewhere, 
// or export a factory. For consistency with other services, let's export a factory or singleton later.
// But `wallet.service.ts` instantiates its own services usually or uses singletons.
// `chainService` and `cryptoService` are singletons. 
// Let's make this importable and instantiated in app.ts or injected.

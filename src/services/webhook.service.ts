import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { randomUUID } from 'crypto';

export class WebhookService {
    constructor(private prisma: PrismaClient) { }

    async createWebhook(url: string, events: string[], secret?: string) {
        return this.prisma.webhook.create({
            data: {
                url,
                events: JSON.stringify(events),
                secret
            }
        });
    }

    async listWebhooks() {
        const webhooks = await this.prisma.webhook.findMany();
        return webhooks.map(w => ({
            ...w,
            events: JSON.parse(w.events) as string[]
        }));
    }

    async deleteWebhook(id: string) {
        return this.prisma.webhook.delete({
            where: { id }
        });
    }

    async dispatch(event: string, payload: any) {
        const webhooks = await this.prisma.webhook.findMany();

        const promises = webhooks.map(async (webhook) => {
            const events = JSON.parse(webhook.events) as string[];
            if (events.includes(event)) {
                try {
                    await axios.post(webhook.url, {
                        id: randomUUID(),
                        event,
                        payload,
                        timestamp: new Date().toISOString()
                    }, {
                        timeout: 5000 // 5s timeout
                    });
                } catch (error) {
                    console.error(`Failed to dispatch webhook to ${webhook.url}:`, (error as Error).message);
                    // In a real system, we would log this failure to DB and retry.
                }
            }
        });

        await Promise.allSettled(promises);
    }
}

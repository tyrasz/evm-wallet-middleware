
import { PrismaClient, Proposal } from '@prisma/client';

export class ProposalService {
    constructor(private prisma: PrismaClient) { }

    async createProposal(
        type: string,
        data: any,
        creator: string
    ): Promise<Proposal> {
        return this.prisma.proposal.create({
            data: {
                type,
                data: JSON.stringify(data),
                status: 'PENDING',
                creator
            }
        });
    }

    async listProposals(status?: string): Promise<Proposal[]> {
        return this.prisma.proposal.findMany({
            where: {
                status: status || undefined
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async approveProposal(id: string, approver: string): Promise<Proposal> {
        const proposal = await this.prisma.proposal.findUnique({ where: { id } });
        if (!proposal) throw new Error('Proposal not found');
        if (proposal.status !== 'PENDING') throw new Error('Proposal is not pending');

        // Execute Action based on Type
        try {
            switch (proposal.type) {
                // For MVP, we will just log the execution. 
                // In production, this would call TransactionService or PolicyService
                case 'HIGH_VALUE_TRANSACTION':
                    console.log('Executing High Value Transaction:', proposal.data);
                    break;
                case 'POLICY_UPDATE':
                    console.log('Executing Policy Update:', proposal.data);
                    break;
                default:
                    console.log('Unknown Proposal Type:', proposal.type);
            }

            return this.prisma.proposal.update({
                where: { id },
                data: {
                    status: 'EXECUTED',
                    approver
                }
            });
        } catch (error) {
            console.error('Execution Failed', error);
            await this.prisma.proposal.update({
                where: { id },
                data: { status: 'FAILED' }
            });
            throw error;
        }
    }

    async rejectProposal(id: string, approver: string): Promise<Proposal> {
        return this.prisma.proposal.update({
            where: { id },
            data: {
                status: 'REJECTED',
                approver
            }
        });
    }
}

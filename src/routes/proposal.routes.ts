
import { FastifyInstance } from 'fastify';
import { ProposalService } from '../services/proposal.service';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../services/auth.service';

export async function proposalRoutes(fastify: FastifyInstance) {
    const proposalService = new ProposalService(fastify.prisma);

    fastify.addHook('preHandler', authMiddleware);

    // Create Proposal (MAKER only)
    fastify.post('/proposals', {
        preHandler: requireRole(UserRole.MAKER),
        schema: {
            tags: ['Proposals'],
            summary: 'Create a new proposal',
            body: {
                type: 'object',
                required: ['type', 'data'],
                properties: {
                    type: { type: 'string' },
                    data: { type: 'object' } // Flexible data
                }
            }
        }
    }, async (request, reply) => {
        const { type, data } = request.body as any;
        const creator = request.user!.apiKeyPrefix;
        return proposalService.createProposal(type, data, creator);
    });

    // List Proposals (MAKER, CHECKER, ADMIN)
    fastify.get('/proposals', {
        schema: {
            tags: ['Proposals'],
            summary: 'List proposals',
            querystring: {
                type: 'object',
                properties: {
                    status: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        // Any authenticated user with role can list. 
        // Ideally we might filter by creator if MAKER, but for now open to all roles.
        const { status } = request.query as any;
        return proposalService.listProposals(status);
    });

    // Approve Proposal (CHECKER only)
    fastify.post('/proposals/:id/approve', {
        preHandler: requireRole(UserRole.CHECKER),
        schema: {
            tags: ['Proposals'],
            summary: 'Approve and execute a proposal',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as any;
        const approver = request.user!.apiKeyPrefix;
        return proposalService.approveProposal(id, approver);
    });

    // Reject Proposal (CHECKER only)
    fastify.post('/proposals/:id/reject', {
        preHandler: requireRole(UserRole.CHECKER),
        schema: {
            tags: ['Proposals'],
            summary: 'Reject a proposal',
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params as any;
        const approver = request.user!.apiKeyPrefix;
        return proposalService.rejectProposal(id, approver);
    });
}

import {
  createRequest,
  type OperationsSnapshot,
  type RequestDraft,
} from './operations-model';

/** Fictitious requests for exercising cross-team handoffs. */
export function createOperationsSeed(): OperationsSnapshot {
  const at = new Date().toISOString();
  const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const drafts: { actor: string; draft: RequestDraft }[] = [
    {
      actor: 'cs-member',
      draft: {
        title: '[Demo] Investigate recurring fit complaints',
        description:
          'The same issue has recurred in customer inquiries. Check vehicle fitment and whether improvements are needed, then report your findings.',
        sourceTeam: 'customer-services',
        targetTeam: 'rd',
        assigneeId: 'rd-member',
        reviewerId: 'USR-KAI',
        priority: 'high',
        dueDate: due,
        category: 'Quality investigation',
        reference: 'Demo case CS-001',
        referencePath: '',
      },
    },
    {
      actor: 'USR-KAI',
      draft: {
        title: '[Demo] Completed product launch handoff',
        description:
          'Review product photos, fitment vehicles, and approval documents, then prepare the listing.',
        sourceTeam: 'rd',
        targetTeam: 'ecommerce',
        assigneeId: 'commerce-member',
        reviewerId: 'commerce-lead',
        priority: 'normal',
        dueDate: due,
        category: 'Launch handoff',
        reference: 'Demo product',
        referencePath: '',
      },
    },
    {
      actor: 'commerce-member',
      draft: {
        title: '[Demo] Promotion inventory request',
        description:
          'Check available inventory and incoming quantities against the promotion schedule.',
        sourceTeam: 'ecommerce',
        targetTeam: 'demand-planning',
        assigneeId: 'planning-member',
        reviewerId: 'planning-lead',
        priority: 'urgent',
        dueDate: due,
        category: 'Inventory allocation',
        reference: 'Demo promotion',
        referencePath: '',
      },
    },
    {
      actor: 'planning-member',
      draft: {
        title: '[Demo] Review new vehicle product development',
        description:
          'Review demand evidence and the target launch schedule, then confirm development feasibility.',
        sourceTeam: 'demand-planning',
        targetTeam: 'rd',
        assigneeId: 'rd-member',
        reviewerId: 'USR-KAI',
        priority: 'normal',
        dueDate: due,
        category: 'Development request',
        reference: 'Demo demand plan',
        referencePath: '',
      },
    },
  ];
  return {
    schemaVersion: 1,
    revision: 0,
    updatedAt: at,
    requests: drafts.map(({ actor, draft }, index) =>
      createRequest(draft, actor, 'DEMO-' + String(index + 1), at),
    ),
  };
}

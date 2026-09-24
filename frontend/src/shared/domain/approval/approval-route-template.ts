import { z } from 'zod';
import { newRouteStep, type ApprovalRouteStepDraft } from './approval-model';

/**
 * The default route an approval type starts with. Approval Flow Management
 * maintains one per type; the submit dialog pre-fills it and the submitter may
 * still adjust before sending, since the API lets the submitter choose.
 */
export const routeTemplateStepSchema = z.object({
  type: z.enum(['FORWARD', 'FINAL']),
  completionRule: z.enum(['ALL', 'ANY']),
  userIds: z.array(z.string()),
});

export const routeTemplateSchema = z.object({
  approvalTypeId: z.string().min(1),
  steps: z.array(routeTemplateStepSchema),
  updatedBy: z.string(),
  updatedAt: z.string(),
});
export const routeTemplateListSchema = z.array(routeTemplateSchema);
export type ApprovalRouteTemplate = z.infer<typeof routeTemplateSchema>;

export const APPROVAL_ROUTE_TEMPLATE_KEY =
  'coverland-approval-route-templates-v1';

/** Demo defaults: one review step, then any of two final approvers. */
export const APPROVAL_ROUTE_TEMPLATE_SEED: readonly ApprovalRouteTemplate[] = [
  {
    approvalTypeId: 'VEHICLE_PRODUCT_REGISTRATION',
    steps: [
      { type: 'FORWARD', completionRule: 'ALL', userIds: ['USR-YOUNG'] },
      {
        type: 'FINAL',
        completionRule: 'ANY',
        userIds: ['USR-KAI', 'USR-JH'],
      },
    ],
    updatedBy: 'Kai',
    updatedAt: '2026-09-22T09:00:00.000Z',
  },
  {
    approvalTypeId: 'VEHICLE_RESEARCH_HANDOFF',
    steps: [
      {
        type: 'FORWARD',
        completionRule: 'ALL',
        userIds: ['USR-YOUNG', 'USR-JH'],
      },
      {
        type: 'FINAL',
        completionRule: 'ANY',
        userIds: ['USR-KAI', 'USR-CHRISTIAN'],
      },
    ],
    updatedBy: 'Kai',
    updatedAt: '2026-09-22T09:00:00.000Z',
  },
];

/** The type's template as editable route steps (fresh ids), or nothing when none is defined. */
export function templateSteps(
  templates: readonly ApprovalRouteTemplate[],
  approvalTypeId: string,
): ApprovalRouteStepDraft[] | undefined {
  const template = templates.find(
    (row) => row.approvalTypeId === approvalTypeId,
  );
  if (!template || template.steps.length === 0) return undefined;
  return template.steps.map((step) =>
    newRouteStep(step.type, step.userIds, step.completionRule),
  );
}

/** Replaces the type's template; ids are dropped because they only exist while editing. */
export function withTemplate(
  templates: readonly ApprovalRouteTemplate[],
  approvalTypeId: string,
  steps: readonly ApprovalRouteStepDraft[],
  updatedBy: string,
): ApprovalRouteTemplate[] {
  const next: ApprovalRouteTemplate = {
    approvalTypeId,
    steps: steps.map(({ type, completionRule, userIds }) => ({
      type,
      completionRule,
      userIds: [...userIds],
    })),
    updatedBy,
    updatedAt: new Date().toISOString(),
  };
  return [
    ...templates.filter((row) => row.approvalTypeId !== approvalTypeId),
    next,
  ];
}

import { z } from 'zod';
import { PROJECT_PIPELINES } from '@/shared/domain/project-stage';
import type { ProductType } from '@/shared/types/workbench';
import type { Person } from '@/modules/operations/operations-model';
import { reportDate } from '@/modules/rd-workspace/report-date';

export const STAGE_DURATION_KEY = 'coverland-stage-durations-v1';
export const STAGE_PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const;
export type StagePriority = (typeof STAGE_PRIORITIES)[number];
const durationDaysSchema = z.number().int().min(1).max(365);
export function suggestedStageDays(
  normalDays: number,
  priority: StagePriority,
): number {
  const multiplier = { URGENT: 0.5, HIGH: 0.75, NORMAL: 1, LOW: 1.5 };
  return Math.max(1, Math.ceil(normalDays * multiplier[priority]));
}
export const STAGE_PRODUCTS = [
  { id: 'PT-SC', name: 'Seat Cover', example: [3, 7, 2, 5, 10, 3] },
  { id: 'PT-CC', name: 'Car Cover', example: [3, 4, 2, 5, 10, 3] },
  { id: 'PT-FM', name: 'Floor Mat', example: [3, 7, 2, 4, 7, 3] },
] as const;
const revisionSchema = z
  .object({
    id: z.string().min(1),
    productTypeId: z.enum(['PT-SC', 'PT-CC', 'PT-FM']),
    updatedAt: z.iso.datetime(),
    updatedBy: z.string().min(1),
    note: z.string().trim().min(1).max(500),
    stages: z.array(
      z.object({
        stage: z.string(),
        targetDays: durationDaysSchema,
        priorityDays: z
          .object({
            URGENT: durationDaysSchema,
            HIGH: durationDaysSchema,
            NORMAL: durationDaysSchema,
            LOW: durationDaysSchema,
          })
          .optional(),
      }),
    ),
  })
  .refine((revision) => {
    const product = STAGE_PRODUCTS.find(
      (entry) => entry.id === revision.productTypeId,
    );
    if (!product) return false;
    const stages = PROJECT_PIPELINES[product.name].filter(
      (stage) => stage !== 'Approved',
    );
    return (
      revision.stages.length === stages.length &&
      stages.every((stage, index) => revision.stages[index]?.stage === stage)
    );
  }, "Check the product's development stage sequence and durations.");
export const stageDurationSchema = z.array(revisionSchema);
export type StageDurationRevision = z.infer<typeof revisionSchema>;
export const EMPTY_STAGE_DURATIONS: StageDurationRevision[] = [];

export function projectStagePlan(
  product: ProductType,
  priority: StagePriority,
) {
  const preset = STAGE_PRODUCTS.find((entry) => entry.name === product);
  if (!preset) throw new Error('Unknown product stage preset.');
  const revision = readStageDurationRevisions()
    .slice()
    .reverse()
    .find((entry) => entry.productTypeId === preset.id);
  return durationStages(product).map((stage, index) => {
    const saved = revision?.stages.find((entry) => entry.stage === stage);
    return {
      stage,
      targetDays:
        saved?.priorityDays?.[priority] ??
        saved?.targetDays ??
        suggestedStageDays(preset.example[index] ?? 1, priority),
    };
  });
}

/** Company standards are writable only by the prototype's R&D lead role. */
export function canEditStageDurations(actor: Person): boolean {
  return actor.team === 'rd' && actor.role === 'lead';
}

/** Append-only revision, with a stale-edit check per product. */
export function appendStageDurationRevision(
  current: StageDurationRevision[],
  draft: StageDurationRevision,
  actor: Person,
  expectedId?: string,
): StageDurationRevision[] {
  if (!canEditStageDurations(actor) || actor.id !== draft.updatedBy)
    throw new Error('Only the R&D lead can edit these settings.');
  const previous = current
    .slice()
    .reverse()
    .find((entry) => entry.productTypeId === draft.productTypeId);
  if (previous?.id !== expectedId)
    throw new Error('Standards changed in another window. Please reload.');
  return stageDurationSchema.parse([...current, revisionSchema.parse(draft)]);
}

/** Read once at a workflow boundary; unavailable standards never fabricate a deadline. */
export function readStageDurationRevisions(): StageDurationRevision[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STAGE_DURATION_KEY);
    return raw ? stageDurationSchema.parse(JSON.parse(raw)) : [];
  } catch {
    // Preserve corrupt storage; the settings screen reports the read failure.
    return [];
  }
}

/** Snapshot a calendar-day deadline at stage start, independent of the project delivery date. */
export function stageTarget(
  revisions: readonly StageDurationRevision[],
  productTypeId: string,
  stage: string,
  startedAt: string,
  priority: StagePriority = 'NORMAL',
  projectPlan?: readonly { stage: string; targetDays: number }[],
): { targetDays?: number; targetDueAt?: string; templateRevisionId?: string } {
  if (stage === 'Approved') return {};
  const revision = revisions
    .slice()
    .reverse()
    .find((entry) => entry.productTypeId === productTypeId);
  const standard = revision?.stages.find((entry) => entry.stage === stage);
  const override = projectPlan?.find((entry) => entry.stage === stage);
  const days =
    override?.targetDays ??
    standard?.priorityDays?.[priority] ??
    standard?.targetDays;
  const start = reportDate(startedAt);
  if (!days || !Number.isInteger(days) || days < 1 || days > 365 || !start)
    return {};
  const due = new Date(`${start}T00:00:00Z`);
  if (due.toISOString().slice(0, 10) !== start) return {};
  due.setUTCDate(due.getUTCDate() + days);
  return {
    targetDays: days,
    targetDueAt: due.toISOString().slice(0, 10),
    ...(!override && revision ? { templateRevisionId: revision.id } : {}),
  };
}

/** Resolve the fixed workflow for each product; completion has no duration. */
export function durationStages(product: ProductType): string[] {
  return PROJECT_PIPELINES[product].filter((stage) => stage !== 'Approved');
}

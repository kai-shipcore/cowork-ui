import { z } from 'zod';
import type { VehicleProjectGroup } from '@/shared/types/workbench';

export const INTAKE_SOURCES = [
  'Notify Me',
  'Complaint',
  'B2B',
  'Vehicle launch',
] as const;
export const INTAKE_STATUSES = [
  'Awaiting review',
  'Development approved',
  'On hold',
  'Rejected',
] as const;
// Normalize only legacy machine values. User-written evidence and review notes remain untouched.
const legacyStatuses: Record<string, (typeof INTAKE_STATUSES)[number]> = {
  '검토 대기': 'Awaiting review',
  '개발 승인': 'Development approved',
  보류: 'On hold',
  반려: 'Rejected',
};
const intakeStatusSchema = z.preprocess(
  (value) =>
    typeof value === 'string' ? (legacyStatuses[value] ?? value) : value,
  z.enum(INTAKE_STATUSES),
);

/** Old bookmarked filters remain valid after switching the interface to English. */
export function parseIntakeStatusFilter(
  value: string | null,
): DevelopmentIntake['status'] | 'All' {
  const result = intakeStatusSchema.safeParse(value);
  return result.success ? result.data : 'All';
}
export const intakeSchema = z.object({
  id: z.string().min(1),
  vehicle: z.string().trim().min(1).max(160),
  configurationId: z.string(),
  product: z.enum(['Seat Cover', 'Floor Mat', 'Car Cover']),
  source: z.preprocess(
    (value) =>
      value === '컴플레인'
        ? 'Complaint'
        : value === '신차 출시'
          ? 'Vehicle launch'
          : value,
    z.enum(INTAKE_SOURCES),
  ),
  sourceReference: z.string().max(300),
  notifyCount: z.number().int().min(0),
  complaintCount: z.number().int().min(0),
  b2bUnits: z.number().int().min(0),
  releaseDate: z.union([z.literal(''), z.iso.date()]),
  evidence: z.string().trim().min(1).max(2000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  status: intakeStatusSchema,
  reviews: z.array(
    z.object({
      at: z.string(),
      status: intakeStatusSchema,
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
      reason: z.string().trim().min(1).max(1000),
      actor: z.string(),
    }),
  ),
  createdAt: z.string(),
});
export const intakesSchema = z.array(intakeSchema);
export type DevelopmentIntake = z.infer<typeof intakeSchema>;
export const EMPTY_INTAKES: DevelopmentIntake[] = [];
export const INTAKE_KEY = 'coverland-development-intakes-v1';

/** Existing matching projects are surfaced instead of silently duplicating development. */
export function linkedIntakeProjects(
  intake: DevelopmentIntake,
  projects: readonly VehicleProjectGroup[],
): VehicleProjectGroup[] {
  return projects.filter(
    (project) =>
      project.vehicleResearchId === intake.configurationId &&
      project.product === intake.product,
  );
}

/** Review is append-only; a reason is required for every priority or decision change. */
export function reviewIntake(
  intake: DevelopmentIntake,
  review: DevelopmentIntake['reviews'][number],
): DevelopmentIntake {
  return intakeSchema.parse({
    ...intake,
    status: review.status,
    priority: review.priority,
    reviews: [...intake.reviews, review],
  });
}

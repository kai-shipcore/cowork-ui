import { z } from 'zod';
import type { VehicleProjectGroup } from '@/shared/types/workbench';

export const INTAKE_SOURCES = [
  'Notify Me',
  '컴플레인',
  'B2B',
  '신차 출시',
] as const;
export const INTAKE_STATUSES = [
  '검토 대기',
  '개발 승인',
  '보류',
  '반려',
] as const;
export const intakeSchema = z.object({
  id: z.string().min(1),
  vehicle: z.string().trim().min(1).max(160),
  configurationId: z.string(),
  product: z.enum(['Seat Cover', 'Floor Mat', 'Car Cover']),
  source: z.enum(INTAKE_SOURCES),
  sourceReference: z.string().max(300),
  notifyCount: z.number().int().min(0),
  complaintCount: z.number().int().min(0),
  b2bUnits: z.number().int().min(0),
  releaseDate: z.union([z.literal(''), z.iso.date()]),
  evidence: z.string().trim().min(1).max(2000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  status: z.enum(INTAKE_STATUSES),
  reviews: z.array(
    z.object({
      at: z.string(),
      status: z.enum(INTAKE_STATUSES),
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

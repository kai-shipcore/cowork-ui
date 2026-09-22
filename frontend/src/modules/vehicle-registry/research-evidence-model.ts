import { z } from 'zod';
import type { VehicleConfiguration } from '@/shared/types/workbench';

const safeSourceUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  );
}, 'Enter an HTTP/HTTPS source URL.');

const evidencePhoto = z
  .string()
  .max(1500000)
  .refine(
    (value) =>
      !value ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
    'Only PNG, JPEG, and WebP photos are supported.',
  );

export const researchSeatTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  sourceUrl: z.union([z.literal(''), safeSourceUrl]),
  photo: evidencePhoto,
  photoName: z.string().max(200),
});

export const researchEvidenceSectionSchema = z.object({
  id: z.string().min(1),
  rowLabel: z.string().trim().min(1).max(100),
  keyNotes: z.string().trim().min(1).max(2000),
  seatTypes: z.array(researchSeatTypeSchema).min(1).max(20),
});

export const researchEvidenceSchema = z.object({
  id: z.string().min(1),
  configurationId: z.string().min(1),
  checkedCount: z.number().int().min(0),
  sources: z.array(safeSourceUrl).max(50),
  photo: evidencePhoto,
  photoName: z.string().max(200),
  categorization: z.string().trim().max(2000).default(''),
  summary: z.string().trim().max(4000).default(''),
  sections: z.array(researchEvidenceSectionSchema).max(20).default([]),
  decision: z.preprocess(
    (value) => {
      const legacy: Record<string, string> = {
        '검토 중': 'Under review',
        '별도 구성 유지': 'Keep separate configuration',
        '병합 제안': 'Propose merge',
      };
      return typeof value === 'string' ? (legacy[value] ?? value) : value;
    },
    z.enum(['Under review', 'Keep separate configuration', 'Propose merge']),
  ),
  mergeTargetId: z.string(),
  reason: z.string().trim().min(1).max(2000),
  actor: z.string(),
  at: z.string(),
});
export const researchEvidenceListSchema = z.array(researchEvidenceSchema);
export type ResearchEvidenceRecord = z.infer<typeof researchEvidenceSchema>;
export type ResearchEvidenceSection = z.infer<
  typeof researchEvidenceSectionSchema
>;
export type ResearchSeatType = z.infer<typeof researchSeatTypeSchema>;
export const EMPTY_RESEARCH_EVIDENCE: ResearchEvidenceRecord[] = [];
export const RESEARCH_EVIDENCE_KEY = 'coverland-research-evidence-v1';

/** Merge recommendations cannot target themselves or an unrelated vehicle. */
export function validateResearchEvidence(
  input: ResearchEvidenceRecord,
  configurations: readonly VehicleConfiguration[],
): ResearchEvidenceRecord {
  const value = researchEvidenceSchema.parse(input);
  const source = configurations.find(
    (item) => item.id === value.configurationId,
  );
  const target = configurations.find((item) => item.id === value.mergeTargetId);
  if (!source) throw new Error('Research configuration not found.');
  if (
    value.decision === 'Propose merge' &&
    (!target || target.id === source.id || target.vehicle !== source.vehicle)
  )
    throw new Error(
      'Select another configuration of the same vehicle as the merge target.',
    );
  return value;
}

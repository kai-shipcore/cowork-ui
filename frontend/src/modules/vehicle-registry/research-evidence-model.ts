import { z } from 'zod';
import type { VehicleConfiguration } from '@/shared/types/workbench';

export const researchEvidenceSchema = z.object({
  id: z.string().min(1),
  configurationId: z.string().min(1),
  checkedCount: z.number().int().min(0),
  sources: z
    .array(
      z.url().refine((value) => {
        const url = new URL(value);
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      }, 'http/https 출처 URL을 입력하세요.'),
    )
    .max(50),
  photo: z
    .string()
    .max(1500000)
    .refine(
      (value) =>
        !value ||
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
      'PNG/JPEG/WebP 사진만 지원합니다.',
    ),
  photoName: z.string().max(200),
  decision: z.enum(['검토 중', '별도 구성 유지', '병합 제안']),
  mergeTargetId: z.string(),
  reason: z.string().trim().min(1).max(2000),
  actor: z.string(),
  at: z.string(),
});
export const researchEvidenceListSchema = z.array(researchEvidenceSchema);
export type ResearchEvidenceRecord = z.infer<typeof researchEvidenceSchema>;
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
  if (!source) throw new Error('조사 구성을 찾지 못했습니다.');
  if (
    value.decision === '병합 제안' &&
    (!target || target.id === source.id || target.vehicle !== source.vehicle)
  )
    throw new Error('같은 차량의 다른 병합 대상 구성을 선택하세요.');
  return value;
}

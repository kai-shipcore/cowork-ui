import { z } from 'zod';

export const researchStatusSchema = z.enum([
  'DRAFT',
  'RESEARCHING',
  'COMPLETE',
]);
export const projectDispositionSchema = z.enum(['PENDING', 'PUSH', 'HOLD']);

export const researchMaterialSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(200),
  sourceUrl: z.union([z.literal(''), z.url()]),
  notes: z.string().max(3000),
  tags: z.array(z.string().trim().min(1).max(80)).max(30),
});

export const researchDetailSchema = z.object({
  id: z.string(),
  configurationId: z.string(),
  researchStatus: researchStatusSchema,
  projectDisposition: projectDispositionSchema,
  holdReason: z.string().max(2000),
  generation: z.string().max(200),
  overview: z.string().max(5000),
  modelYears: z.string().max(100),
  trimLevels: z.string().max(3000),
  frontSeats: z.string().max(3000),
  secondRow: z.string().max(3000),
  thirdRow: z.string().max(3000),
  optionalFeatures: z.string().max(3000),
  materials: z.array(researchMaterialSchema).max(50),
  actor: z.string(),
  at: z.string(),
});

export const researchDetailListSchema = z.array(researchDetailSchema);
export type ResearchDetailRecord = z.infer<typeof researchDetailSchema>;
export type ResearchMaterial = z.infer<typeof researchMaterialSchema>;

export const researchCommentSchema = z.object({
  id: z.string(),
  configurationId: z.string(),
  message: z.string().trim().min(1).max(2000),
  author: z.string(),
  createdAt: z.string(),
});
export const researchCommentListSchema = z.array(researchCommentSchema);
export type ResearchComment = z.infer<typeof researchCommentSchema>;

export const RESEARCH_DETAIL_KEY = 'coverland-vehicle-research-detail-v1';
export const RESEARCH_COMMENT_KEY = 'coverland-vehicle-research-comments-v1';

export function newResearchMaterial(): ResearchMaterial {
  return {
    id: crypto.randomUUID(),
    title: '',
    sourceUrl: '',
    notes: '',
    tags: [],
  };
}

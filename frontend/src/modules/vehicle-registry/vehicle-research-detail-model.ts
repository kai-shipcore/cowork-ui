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

/**
 * Demo timeline for the Toyota RAV4 hybrid configuration (c01): two saved
 * research rounds. Shown until the browser stores its own records.
 */
export const RESEARCH_DETAIL_SEED: readonly ResearchDetailRecord[] = [
  {
    id: 'research-detail-seed-c01-1',
    configurationId: 'c01',
    researchStatus: 'RESEARCHING',
    projectDisposition: 'PENDING',
    holdReason: '',
    generation: '5th generation (XA50)',
    overview:
      'Hybrid trims share the gas body but the 2nd row bench differs by trim.',
    modelYears: '2023–2026',
    trimLevels: 'LE, XLE, XLE Premium, Limited',
    frontSeats: 'Bucket seats · adjustable headrests · XLE and above are power',
    secondRow: '60/40 split bench · fold-down center armrest',
    thirdRow: 'None',
    optionalFeatures: 'Ventilated front seats on Limited',
    materials: [
      {
        id: 'research-material-seed-c01-1',
        title: '2024 RAV4 Hybrid XLE interior gallery',
        sourceUrl: 'https://www.toyota.com/rav4hybrid/',
        notes: 'Confirms bucket fronts and 60/40 bench; headrests removable.',
        tags: ['Seat Cover', 'Front seat', 'Second row', 'Hybrid'],
      },
    ],
    actor: 'Kai (Demo)',
    at: '2026-09-10T09:20:00.000Z',
  },
  {
    id: 'research-detail-seed-c01-2',
    configurationId: 'c01',
    researchStatus: 'COMPLETE',
    projectDisposition: 'PUSH',
    holdReason: '',
    generation: '5th generation (XA50)',
    overview:
      'Hybrid trims share the gas body but the 2nd row bench differs by trim. Under-seat storage absent on all hybrid trims.',
    modelYears: '2023–2026',
    trimLevels: 'LE, XLE, XLE Premium, Limited',
    frontSeats: 'Bucket seats · adjustable headrests · XLE and above are power',
    secondRow: '60/40 split bench · fold-down center armrest · no storage',
    thirdRow: 'None',
    optionalFeatures: 'Ventilated front seats on Limited',
    materials: [
      {
        id: 'research-material-seed-c01-1',
        title: '2024 RAV4 Hybrid XLE interior gallery',
        sourceUrl: 'https://www.toyota.com/rav4hybrid/',
        notes: 'Confirms bucket fronts and 60/40 bench; headrests removable.',
        tags: ['Seat Cover', 'Front seat', 'Second row', 'Hybrid'],
      },
      {
        id: 'research-material-seed-c01-2',
        title: 'Dealer scan · Galpin Toyota · 2025 Limited',
        sourceUrl: '',
        notes: 'Measured 2nd row bench width; no under-seat storage tray.',
        tags: ['Seat Cover', 'Second row', 'Bench'],
      },
    ],
    actor: 'Kai (Demo)',
    at: '2026-09-18T15:05:00.000Z',
  },
];

/** Demo review thread for c01, interleaved with the saved rounds above. */
export const RESEARCH_COMMENT_SEED: readonly ResearchComment[] = [
  {
    id: 'research-comment-seed-c01-1',
    configurationId: 'c01',
    message:
      'Started the hybrid configuration. Need a second source for the 2nd row armrest on LE.',
    author: 'Kai (Demo)',
    createdAt: '2026-09-10T09:25:00.000Z',
  },
  {
    id: 'research-comment-seed-c01-2',
    configurationId: 'c01',
    message:
      'Galpin visit booked for 9/17. Will check under-seat storage in person.',
    author: 'R&D Member (Demo)',
    createdAt: '2026-09-12T17:40:00.000Z',
  },
  {
    id: 'research-comment-seed-c01-3',
    configurationId: 'c01',
    message:
      'Scan done. No storage tray on any hybrid trim, so c02 stays a separate configuration.',
    author: 'R&D Member (Demo)',
    createdAt: '2026-09-17T22:10:00.000Z',
  },
  {
    id: 'research-comment-seed-c01-4',
    configurationId: 'c01',
    message:
      'Research complete and pushed to development. Seat Cover project PG-00124 is linked.',
    author: 'Kai (Demo)',
    createdAt: '2026-09-18T15:08:00.000Z',
  },
];

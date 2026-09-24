import { z } from 'zod';

export const RESEARCH_CONFIGURATION_VERSION_KEY =
  'coverland.vehicle-research.configuration-versions.v1';

export const researchConfigurationVersionStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SUPERSEDED',
  'REJECTED',
]);

export const researchConfigurationVersionSchema = z.object({
  id: z.string(),
  researchConfigurationId: z.string(),
  versionNumber: z.number().int().min(1),
  status: researchConfigurationVersionStatusSchema,
  action: z.enum(['UPSERT', 'DELETE']).default('UPSERT'),
  years: z.array(z.number().int().min(1900).max(2200)).max(30),
  options: z.array(
    z.tuple([
      z.string().trim().min(1).max(100),
      z.string().trim().min(1).max(200),
    ]),
  ),
  changeSummary: z.string().trim().max(500).default(''),
  actor: z.string(),
  createdAt: z.string(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
});

export const researchConfigurationVersionListSchema = z.array(
  researchConfigurationVersionSchema,
);

export type ResearchConfigurationVersion = z.infer<
  typeof researchConfigurationVersionSchema
>;
export type ResearchConfigurationVersionStatus = z.infer<
  typeof researchConfigurationVersionStatusSchema
>;

export const RESEARCH_CONFIGURATION_VERSION_SEED: readonly ResearchConfigurationVersion[] =
  [
    {
      id: 'rcv-c01-pt-sc-1',
      researchConfigurationId: 'c01:PT-SC',
      versionNumber: 1,
      status: 'APPROVED',
      action: 'UPSERT',
      years: [2023, 2024, 2025, 2026],
      options: [
        ['Powertrain', 'Hybrid'],
        ['Seats', '5 Seats'],
        ['Front Seat', 'Bucket'],
        ['2nd Row Seat', 'Bench'],
        ['Headrest', 'Adjustable'],
        ['Under-seat Storage', 'No Storage'],
      ],
      changeSummary: 'Initial configuration approved with vehicle research.',
      actor: 'Kai (Demo)',
      createdAt: '2026-09-18T15:05:00.000Z',
      reviewedBy: 'Christian (Demo)',
      reviewedAt: '2026-09-18T15:08:00.000Z',
    },
  ];

export function nextResearchConfigurationVersionNumber(
  records: readonly ResearchConfigurationVersion[],
  researchConfigurationId: string,
) {
  return (
    Math.max(
      0,
      ...records
        .filter(
          (record) =>
            record.researchConfigurationId === researchConfigurationId,
        )
        .map((record) => record.versionNumber),
    ) + 1
  );
}

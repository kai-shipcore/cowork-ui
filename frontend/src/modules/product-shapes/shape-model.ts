import type { FitmentQuality } from '@/shared/types/db-workflow';
import type {
  ProductShapeDimension,
  ProjectDesign,
  ProjectDetailSnapshot,
  ProjectVisit,
  VehicleProductShape,
  VehicleProjectGroup,
  ZoneProject,
} from '@/shared/types/workbench';

export function hasCurrentFitmentQuality(
  zoneId: string,
  designs: readonly ProjectDesign[],
  visits: readonly ProjectVisit[],
  records: readonly FitmentQuality[],
): boolean {
  const relevant = records.filter((row) => row.vehicleProjectId === zoneId);
  const evidence = sizeReviewEvidence(zoneId, designs, visits);
  const overallIndex = relevant.reduce(
    (last, row, index) => (row.vehicleProductDesignId ? last : index),
    -1,
  );
  const overall = relevant[overallIndex];
  if (overall?.quality !== 'PASS' || overall.evidenceKey !== evidence)
    return false;
  const parts = designs.filter(
    (row) => row.vehicleProjectId === zoneId && row.status === 'ACTIVE',
  );
  return (
    parts.length > 0 &&
    parts.every((part) => {
      const index = relevant.reduce(
        (last, row, current) =>
          row.vehicleProductDesignId === part.id ? current : last,
        -1,
      );
      return (
        index >= 0 &&
        index < overallIndex &&
        relevant[index].quality === 'PASS' &&
        relevant[index].evidenceKey === evidence
      );
    })
  );
}

export const SHAPE_STATUSES = {
  IN_DEVELOPMENT: 'In development',
  ACTIVE: 'Confirmed Shape',
  RETIRED: 'Disabled for new usage',
} as const;

export interface ShapeInput {
  productTypeId: string;
  name: string;
  status: VehicleProductShape['status'];
  dimensions?: ProductShapeDimension;
}

export function shapeErrors(
  input: ShapeInput,
  shapes: readonly VehicleProductShape[],
  id?: string,
): readonly string[] {
  const errors: string[] = [];
  if (
    input.productTypeId === 'PT-CC' &&
    input.status === 'ACTIVE' &&
    !input.dimensions
  )
    errors.push('Confirmed Car Covers require finished dimensions.');
  if (input.productTypeId !== 'PT-CC' && input.dimensions)
    errors.push('Shape dimensions are supported only for Car Cover.');
  if (!input.name.trim()) errors.push('Enter a Shape name.');
  if (
    shapes.some(
      (shape) =>
        shape.id !== id &&
        shape.productTypeId === input.productTypeId &&
        shape.name.trim().toLocaleLowerCase() ===
          input.name.trim().toLocaleLowerCase(),
    )
  ) {
    errors.push(
      'A Shape with this name exists for the same product type. Link it or choose another name.',
    );
  }
  if (input.dimensions) {
    const { length, height, frontWidth, backWidth } = input.dimensions;
    if ((frontWidth === undefined) !== (backWidth === undefined))
      errors.push('Enter both front and rear widths, or leave both blank.');
    if (
      ![
        length,
        height,
        ...(frontWidth === undefined ? [] : [frontWidth]),
        ...(backWidth === undefined ? [] : [backWidth]),
      ].every((value) => Number.isFinite(value) && value > 0)
    ) {
      errors.push(
        'Dimensions must be positive numbers. Enter both length and height.',
      );
    }
  }
  return errors;
}

export function shapeUsage(
  id: string,
  projects: readonly VehicleProjectGroup[],
) {
  return projects.flatMap((project) =>
    project.zoneProjects
      .filter((zone) => zone.productShapeId === id)
      .map((zone) => ({ project, zone })),
  );
}

/** Master records win after migration; legacy embedded records are imported only once. */
export function collectShapes(
  masters: readonly VehicleProductShape[],
  projects: readonly VehicleProjectGroup[],
  details: Readonly<Record<string, ProjectDetailSnapshot>>,
  migrateEmbedded: boolean,
): readonly VehicleProductShape[] {
  const byId = new Map(masters.map((shape) => [shape.id, shape]));
  if (migrateEmbedded) {
    for (const detail of Object.values(details))
      for (const zone of detail.zones) {
        // Earlier prototypes auto-activated draft shapes on fitting PASS. Import
        // their identity without treating that flag as final Shape approval.
        const existing = zone.productShape
          ? byId.get(zone.productShape.id)
          : undefined;
        if (
          zone.productShape &&
          (!existing ||
            (existing.createdBy === 'Legacy data' &&
              existing.status === 'IN_DEVELOPMENT'))
        )
          byId.set(zone.productShape.id, {
            ...zone.productShape,
            status:
              zone.productShape.status === 'RETIRED'
                ? 'RETIRED'
                : 'IN_DEVELOPMENT',
          });
      }
  }
  for (const project of projects)
    for (const zone of project.zoneProjects) {
      if (zone.productShapeId && !byId.has(zone.productShapeId))
        byId.set(zone.productShapeId, {
          id: zone.productShapeId,
          productTypeId: project.productTypeId,
          name: zone.productShapeId,
          status: 'IN_DEVELOPMENT',
          source: 'NEW',
          createdBy: 'Legacy data',
          createdAt: project.created,
        });
    }
  return [...byId.values()];
}

export function dimensionsLabel(dimension?: ProductShapeDimension): string {
  if (!dimension || dimension.length <= 0 || dimension.height <= 0)
    return 'Dimensions not registered';
  return `Length ${dimension.length} / Front width ${dimension.frontWidth ?? '—'} / Rear width ${dimension.backWidth ?? '—'} / Height ${dimension.height} ${dimension.unit.toLowerCase()}`;
}

/** A shared shape status is never evidence of this project's fitting result. */
export function latestFitting(
  zoneId: string,
  visits: readonly ProjectVisit[],
): ProjectVisit | undefined {
  const completed = visits
    .filter(
      (visit) =>
        visit.type === 'FITTING' &&
        visit.status === 'COMPLETED' &&
        visit.vehicleProjectIds.includes(zoneId),
    )
    .sort(
      (a, b) =>
        Date.parse(a.performedAt ?? `${a.date}T${a.time}`) -
        Date.parse(b.performedAt ?? `${b.date}T${b.time}`),
    );
  return completed[completed.length - 1];
}

export function latestFittingPassed(
  zoneId: string,
  visits: readonly ProjectVisit[],
): boolean {
  return latestFitting(zoneId, visits)?.result === 'PASS';
}

export function sizeReviewEvidence(
  zoneId: string,
  designs: readonly ProjectDesign[],
  visits: readonly ProjectVisit[],
): string {
  const parts = designs
    .filter(
      (design) =>
        design.vehicleProjectId === zoneId && design.status === 'ACTIVE',
    )
    .map((design) => [
      design.id,
      design.quantity,
      design.libraryRevisionId,
      design.details,
      design.revisions
        .map((revision) => [revision.id, revision.dxfFingerprint])
        .sort(),
      design.fittingConfirmed,
    ]);
  const fittings = visits
    .filter(
      (visit) =>
        visit.type === 'FITTING' && visit.vehicleProjectIds.includes(zoneId),
    )
    .map((visit) => [
      visit.id,
      visit.status,
      visit.result,
      visit.performedAt,
      visit.date,
      visit.time,
    ]);
  return JSON.stringify([parts.sort(), fittings.sort()]);
}

export function sizeReviewBlockers(
  zone: ZoneProject,
  designs: readonly ProjectDesign[],
  visits: readonly ProjectVisit[],
): readonly string[] {
  const errors: string[] = [];
  if (!['Fitting', 'Approved'].includes(zone.currentStage))
    errors.push('Start Shape review in Fitting after final sample inspection.');
  if (!latestFittingPassed(zone.id, visits))
    errors.push(
      "Record PASS for this zone's latest completed fitting in Visits.",
    );
  const parts = designs.filter(
    (design) =>
      design.vehicleProjectId === zone.id && design.status === 'ACTIVE',
  );
  if (!parts.length)
    errors.push('No final parts / pattern to review. Link them first.');
  else if (
    parts.some(
      (part) =>
        !part.fittingConfirmed ||
        !part.revisions.length ||
        part.quantity <= 0 ||
        part.requiresRevisionAfterReview,
    )
  )
    errors.push(
      'Confirm the final parts / pattern quantities, current revisions, and fitting.',
    );
  const fitting = latestFitting(zone.id, visits);
  if (fitting?.result === 'PASS') {
    const performedAt = Date.parse(
      fitting.performedAt ?? `${fitting.date}T${fitting.time}`,
    );
    if (
      parts.some((part) =>
        part.revisions.some(
          (revision) => Date.parse(revision.createdAt) > performedAt,
        ),
      )
    )
      errors.push(
        'A revision was added after the last fitting. Repeat fitting with the new revision.',
      );
  }
  return errors;
}

export function isSizeReviewCurrent(
  zone: ZoneProject,
  designs: readonly ProjectDesign[],
  visits: readonly ProjectVisit[],
): boolean {
  return Boolean(
    zone.sizeReview?.outcome === 'APPROVED' &&
    zone.sizeReview.approvalMethod === 'VERBAL' &&
    zone.sizeReview.meetingAt &&
    Date.parse(zone.sizeReview.meetingAt) >=
      Math.floor(
        Date.parse(
          latestFitting(zone.id, visits)?.performedAt ??
            `${latestFitting(zone.id, visits)?.date}T${latestFitting(zone.id, visits)?.time}`,
        ) / 60000,
      ) *
        60000 &&
    Date.parse(zone.sizeReview.meetingAt) <= Date.now() &&
    (zone.sizeReview.participants?.length ?? 0) >= 5 &&
    zone.sizeReview?.blueprintReference.trim() &&
    zone.sizeReview.reviewedBy &&
    zone.sizeReview.evidenceKey ===
      sizeReviewEvidence(zone.id, designs, visits) &&
    sizeReviewBlockers(zone, designs, visits).length === 0,
  );
}

export function handoffReady(
  zone: ZoneProject,
  designs: readonly ProjectDesign[],
  visits: readonly ProjectVisit[],
): boolean {
  return handoffBlockers(zone, designs, visits).length === 0;
}

export function handoffBlockers(
  zone: ZoneProject,
  designs: readonly ProjectDesign[],
  visits: readonly ProjectVisit[],
): readonly string[] {
  const parts = designs.filter(
    (part) => part.vehicleProjectId === zone.id && part.status === 'ACTIVE',
  );
  const fitting = latestFitting(zone.id, visits);
  const performedAt = fitting
    ? Date.parse(fitting.performedAt ?? `${fitting.date}T${fitting.time}`)
    : 0;
  const errors: string[] = [];
  if (!['Fitting', 'Approved'].includes(zone.currentStage))
    errors.push(`${zone.code}: Finish sampling and proceed to Fitting.`);
  if (fitting?.result !== 'PASS')
    errors.push(`${zone.code}: The latest completed fitting must be PASS.`);
  if (
    zone.reworkRequestedAt &&
    performedAt <= Date.parse(zone.reworkRequestedAt)
  )
    errors.push(
      `${zone.code}: Repeat fitting with new samples after rejection.`,
    );
  if (!parts.length) errors.push(`${zone.code}: No final parts list.`);
  if (
    parts.some(
      (part) =>
        !part.fittingConfirmed ||
        part.requiresRevisionAfterReview ||
        part.quantity <= 0 ||
        !part.revisions.length,
    )
  )
    errors.push(
      `${zone.code}: Confirm final part revisions, quantities, and fitting.`,
    );
  if (
    parts.some((part) =>
      part.revisions.some(
        (revision) => Date.parse(revision.createdAt) > performedAt,
      ),
    )
  )
    errors.push(`${zone.code}: Repeat fitting with the latest revision.`);
  return errors;
}

export function compositionIsCurrent(
  shape: VehicleProductShape,
  details: Readonly<Record<string, ProjectDetailSnapshot>>,
): boolean {
  const composition = shape.composition;
  if (
    !composition ||
    composition.status !== 'COMPLETE' ||
    !/^https?:\/\//i.test(composition.blueprintUrl)
  )
    return false;
  const detail = details[composition.sourceProjectId];
  const zone = detail?.zones.find(
    (item) => item.id === composition.sourceZoneId,
  );
  if (
    !zone ||
    zone.productShapeId !== shape.id ||
    !isSizeReviewCurrent(zone, detail.designs, detail.visits)
  )
    return false;
  const parts = detail.designs.filter(
    (part) => part.vehicleProjectId === zone.id && part.status === 'ACTIVE',
  );
  return (
    parts.length > 0 &&
    parts.length === composition.parts.length &&
    parts.every((part) => {
      const revision = [...part.revisions].sort(
        (a, b) => b.revisionNumber - a.revisionNumber,
      )[0];
      return composition.parts.some(
        (saved) =>
          saved.designId === part.id &&
          saved.name === part.name &&
          saved.quantity === part.quantity &&
          saved.revisionId === revision?.id,
      );
    })
  );
}

export function applyShapeReview(
  detail: ProjectDetailSnapshot,
  zoneId: string,
  review: NonNullable<ZoneProject['sizeReview']>,
): ProjectDetailSnapshot {
  const rework =
    review.outcome === 'REJECTED' && review.rejectionType === 'PATTERN';
  return {
    ...detail,
    zones: detail.zones.map((zone) =>
      zone.id !== zoneId
        ? zone
        : {
            ...zone,
            sizeReview: review,
            shapeReviewHistory: [
              ...(zone.shapeReviewHistory ??
                (zone.sizeReview ? [zone.sizeReview] : [])),
              review,
            ],
            ...(rework
              ? {
                  currentStage: 'Sample' as const,
                  reworkRequestedAt: review.reviewedAt,
                }
              : {}),
          },
    ),
    designs: rework
      ? detail.designs.map((part) =>
          part.vehicleProjectId === zoneId && part.status === 'ACTIVE'
            ? {
                ...part,
                fittingConfirmed: false,
                requiresRevisionAfterReview: review.affectedDesignIds?.length
                  ? review.affectedDesignIds.includes(part.id)
                  : true,
              }
            : part,
        )
      : detail.designs,
  };
}

export function shapeWorkflowLabel(
  zone: ZoneProject,
  designs?: readonly ProjectDesign[],
  visits?: readonly ProjectVisit[],
): string {
  if (
    zone.sizeReview?.outcome === 'APPROVED' &&
    designs &&
    visits &&
    !isSizeReviewCurrent(zone, designs, visits)
  )
    return 'Materials changed · Recheck handoff and review';
  if (zone.reworkRequestedAt && zone.currentStage !== 'Approved')
    return 'Pattern rework · Restart with new samples';
  if (zone.sizeReview?.outcome === 'REJECTED')
    return zone.sizeReview.rejectionType === 'DOCUMENT'
      ? 'Document corrections · Awaiting review'
      : 'New samples and fitting · Awaiting review';
  if (zone.productShapeId && zone.sizeReview?.outcome === 'APPROVED')
    return 'Shape review approved · Check confirmation status';
  if (!['Fitting', 'Approved'].includes(zone.currentStage))
    return 'Development in progress · Shape creation available';
  return zone.sizeReview?.outcome === 'APPROVED'
    ? 'Approved · Awaiting issuance'
    : 'Awaiting review';
}

export function sizeReady(
  zone: ZoneProject,
  designs: readonly ProjectDesign[],
  visits: readonly ProjectVisit[],
): boolean {
  return Boolean(
    zone.productShapeId &&
    zone.productShape?.id === zone.productShapeId &&
    zone.productShape.productTypeId === zone.productTypeId &&
    zone.productShape.status === 'ACTIVE' &&
    isSizeReviewCurrent(zone, designs, visits),
  );
}

/** Drop the removed ambiguous reference without guessing a shape or merge. */
export function removeLegacyAdoption<T extends object>(value: T): T {
  const copy = { ...value } as T & { adoptedProjectId?: unknown };
  delete copy.adoptedProjectId;
  return copy;
}

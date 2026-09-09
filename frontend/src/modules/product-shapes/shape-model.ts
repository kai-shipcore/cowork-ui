import type {
  ProductShapeDimension,
  ProjectDesign,
  ProjectDetailSnapshot,
  ProjectVisit,
  VehicleProductShape,
  VehicleProjectGroup,
  ZoneProject,
} from '@/shared/types/workbench';

export const SHAPE_STATUSES = {
  IN_DEVELOPMENT: '확정 여부 확인 필요',
  ACTIVE: '확정 Shape',
  RETIRED: '신규 사용 중지',
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
  if (!input.name.trim()) errors.push('Shape 이름을 입력하세요.');
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
      '같은 제품 유형에 동일한 Shape 이름이 있습니다. 기존 Shape를 연결하거나 다른 이름을 입력하세요.',
    );
  }
  if (input.dimensions) {
    const { length, height, frontWidth, backWidth } = input.dimensions;
    if (
      ![
        length,
        height,
        ...(frontWidth === undefined ? [] : [frontWidth]),
        ...(backWidth === undefined ? [] : [backWidth]),
      ].every((value) => Number.isFinite(value) && value > 0)
    ) {
      errors.push(
        '치수는 0보다 큰 숫자여야 합니다. 길이와 높이를 모두 입력하세요.',
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
    return '치수 미등록';
  return `길이 ${dimension.length} / 앞폭 ${dimension.frontWidth ?? '—'} / 뒤폭 ${dimension.backWidth ?? '—'} / 높이 ${dimension.height} ${dimension.unit.toLowerCase()}`;
}

/** A shared shape status is never evidence of this project's fitting result. */
function latestFitting(
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
  if (zone.currentStage !== 'Approved' || !zone.productionHandoff)
    errors.push(
      '프로젝트에서 양산 인계를 완료해야 Shape 검토를 시작할 수 있습니다.',
    );
  else if (
    zone.productionHandoff.evidenceKey !==
    sizeReviewEvidence(zone.id, designs, visits)
  )
    errors.push(
      '양산 인계 후 Part 또는 피팅 자료가 변경되었습니다. 프로젝트에서 다시 인계하세요.',
    );
  if (!latestFittingPassed(zone.id, visits))
    errors.push(
      'Visits에서 해당 Zone의 최신 완료 피팅 결과를 PASS로 기록하세요.',
    );
  const parts = designs.filter(
    (design) =>
      design.vehicleProjectId === zone.id && design.status === 'ACTIVE',
  );
  if (!parts.length)
    errors.push(
      '검토할 최종 Part / 패턴 목록이 없습니다. Part / 패턴을 먼저 연결하세요.',
    );
  else if (
    parts.some(
      (part) =>
        !part.fittingConfirmed ||
        !part.revisions.length ||
        part.quantity <= 0 ||
        part.requiresRevisionAfterReview,
    )
  )
    errors.push('최종 Part / 패턴의 수량·현재 버전과 피팅 확인을 완료하세요.');
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
        '마지막 피팅 이후 추가된 버전이 있습니다. 새 버전으로 다시 피팅하세요.',
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
        Date.parse(zone.productionHandoff?.completedAt ?? '') / 60000,
      ) *
        60000 &&
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
    errors.push(`${zone.code}: 샘플 작업 후 Fitting 단계까지 진행하세요.`);
  if (fitting?.result !== 'PASS')
    errors.push(`${zone.code}: 최신 완료 피팅 결과가 PASS여야 합니다.`);
  if (
    zone.reworkRequestedAt &&
    performedAt <= Date.parse(zone.reworkRequestedAt)
  )
    errors.push(`${zone.code}: 반려 후 새 샘플로 다시 피팅하세요.`);
  if (!parts.length) errors.push(`${zone.code}: 최종 Part 목록이 없습니다.`);
  if (
    parts.some(
      (part) =>
        !part.fittingConfirmed ||
        part.requiresRevisionAfterReview ||
        part.quantity <= 0 ||
        !part.revisions.length,
    )
  )
    errors.push(`${zone.code}: 최종 Part 버전·수량과 피팅 확인을 완료하세요.`);
  if (
    parts.some((part) =>
      part.revisions.some(
        (revision) => Date.parse(revision.createdAt) > performedAt,
      ),
    )
  )
    errors.push(`${zone.code}: 최신 Revision으로 다시 피팅하세요.`);
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
    return '자료 변경 · 인계·검토 재확인 필요';
  if (zone.reworkRequestedAt && zone.currentStage !== 'Approved')
    return '패턴 재작업 · 새 샘플부터 재진행';
  if (!zone.productionHandoff)
    return zone.currentStage === 'Approved'
      ? '기존 완료 · 인계 확인 필요'
      : '개발 진행 중';
  if (zone.sizeReview?.outcome === 'REJECTED')
    return zone.sizeReview.rejectionType === 'DOCUMENT'
      ? '문서 보완 · 재검토 대기'
      : '재인계 · 재검토 대기';
  if (zone.productShapeId && zone.sizeReview?.outcome === 'APPROVED')
    return 'Shape 연결됨';
  return zone.sizeReview?.outcome === 'APPROVED'
    ? '승인 완료 · 발급 대기'
    : '검토 대기';
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

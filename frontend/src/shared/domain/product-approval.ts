import type { WorkbenchState } from '@/app/workbench-store';
import type { ApprovalRequest, ApprovalStep } from '../types/db-workflow';

export const PRODUCT_APPROVAL_TYPE = 'VEHICLE_PRODUCT_REGISTRATION';
export type ApprovalRoute = readonly {
  type: 'FORWARD' | 'FINAL';
  users: readonly string[];
}[];

function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function activeUser(state: WorkbenchState, id: string) {
  return state.appUsers.some(
    (user) => user.id === id && user.status === 'ACTIVE',
  );
}
function authorized(
  state: WorkbenchState,
  id: string,
  type: ApprovalStep['type'],
) {
  return (
    activeUser(state, id) &&
    state.approvalGrants.some(
      (grant) =>
        grant.appUserId === id &&
        grant.approvalTypeId === PRODUCT_APPROVAL_TYPE &&
        grant.status === 'ACTIVE' &&
        (type === 'FINAL' ? grant.canFinalApprove : grant.canForward),
    )
  );
}
export function registrationSnapshot(
  state: WorkbenchState,
  registrationId: string,
): string {
  const items = state.registrationItems
    .filter((item) => item.registrationId === registrationId)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({
    registration: state.registrations.find((row) => row.id === registrationId),
    items,
    products: items.map((item) =>
      state.masterProducts.find(
        (product) => product.id === item.masterProductId,
      ),
    ),
  });
}
function validateProducts(state: WorkbenchState, ids: readonly string[]) {
  requireCondition(
    ids.length > 0 && new Set(ids).size === ids.length,
    '승인할 제품이 없거나 중복됩니다.',
  );
  const skus = new Set<string>();
  for (const id of ids) {
    const product = state.masterProducts.find((row) => row.id === id);
    requireCondition(
      product?.status === 'DRAFT',
      '모든 대상 제품은 DRAFT 상태여야 합니다.',
    );
    const sku = product.sku.trim().toLowerCase();
    requireCondition(sku && !skus.has(sku), 'SKU가 비어 있거나 중복됩니다.');
    skus.add(sku);
    requireCondition(
      !state.masterProductSkus.some(
        (row) => row.sku.trim().toLowerCase() === sku,
      ) &&
        !state.masterProducts.some(
          (row) => row.id !== id && row.sku.trim().toLowerCase() === sku,
        ),
      '이미 사용된 SKU는 다시 발급할 수 없습니다.',
    );
    requireCondition(
      state.productMaterials.some(
        (row) =>
          row.id === product.productMaterialId &&
          row.productTypeId === product.productTypeId,
      ) &&
        state.productColors.some(
          (row) =>
            row.id === product.productColorId &&
            row.productTypeId === product.productTypeId,
        ),
      '제품 유형에 맞는 소재·색상이 필요합니다.',
    );
    const shapes = [
      product.exteriorShapeId,
      product.frontShapeId,
      product.rearShapeId,
      product.thirdRowShapeId,
    ].filter((id): id is string => Boolean(id));
    requireCondition(
      shapes.length > 0 || product.vehicleProductDesignId,
      '제품 Shape 또는 부품 참조가 필요합니다.',
    );
    requireCondition(
      !(shapes.length && product.vehicleProductDesignId),
      'Shape 제품과 부품 제품은 동시에 지정할 수 없습니다.',
    );
    requireCondition(
      shapes.every((id) =>
        state.vehicleProductShapes.some(
          (row) =>
            row.id === id &&
            row.productTypeId === product.productTypeId &&
            row.status === 'ACTIVE',
        ),
      ),
      '확정된 동일 제품 유형의 Shape가 필요합니다.',
    );
  }
}
export function submitProductApproval(
  state: WorkbenchState,
  registrationId: string,
  actor: string,
  route: ApprovalRoute,
): WorkbenchState {
  const registration = state.registrations.find(
    (row) => row.id === registrationId,
  );
  requireCondition(
    registration && !registration.approvedAt && activeUser(state, actor),
    '유효한 미승인 등록과 활성 요청자가 필요합니다.',
  );
  requireCondition(
    !state.approvalRequests.some(
      (row) =>
        row.entityId === registrationId &&
        (row.status === 'PENDING' || row.status === 'APPROVED'),
    ),
    '진행 중이거나 승인된 요청이 있습니다.',
  );
  requireCondition(
    route.length > 0 &&
      route[route.length - 1].type === 'FINAL' &&
      route.filter((step) => step.type === 'FINAL').length === 1,
    '마지막에 하나의 FINAL 단계가 필요합니다.',
  );
  requireCondition(
    route.every(
      (step) =>
        step.users.length > 0 &&
        new Set(step.users).size === step.users.length &&
        step.users.every((user) => authorized(state, user, step.type)),
    ),
    '각 단계에 해당 권한을 가진 활성 승인자를 지정하세요.',
  );
  const items = state.registrationItems.filter(
    (row) => row.registrationId === registrationId,
  );
  const productIds = items.map((row) => row.masterProductId);
  validateProducts(state, productIds);
  const sourceShapeIds = [
    ...new Set(items.flatMap((row) => row.sourceShapeIds ?? [])),
  ];
  requireCondition(
    sourceShapeIds.every((id) =>
      state.vehicleProductShapes.some((shape) => shape.id === id),
    ),
    '등록 근거 Shape를 찾을 수 없습니다.',
  );
  const now = new Date().toISOString();
  const request: ApprovalRequest = {
    id: crypto.randomUUID(),
    approvalTypeId: PRODUCT_APPROVAL_TYPE,
    entityType: 'VEHICLE_PRODUCT_REGISTRATION',
    entityId: registrationId,
    requestedBy: actor,
    submittedData: {
      productIds,
      sourceShapeIds,
      snapshot: registrationSnapshot(state, registrationId),
    },
    status: 'PENDING',
    createdAt: now,
  };
  const steps: ApprovalStep[] = route.map((step, index) => ({
    id: crypto.randomUUID(),
    approvalRequestId: request.id,
    stepNumber: index + 1,
    type: step.type,
    status: index === 0 ? 'PENDING' : 'WAITING',
    activatedAt: index === 0 ? now : undefined,
  }));
  return {
    ...state,
    approvalRequests: [...state.approvalRequests, request],
    approvalSteps: [...state.approvalSteps, ...steps],
    approvalAssignments: [
      ...state.approvalAssignments,
      ...steps.flatMap((step, index) =>
        route[index].users.map((user) => ({
          id: crypto.randomUUID(),
          approvalRequestStepId: step.id,
          assignedTo: user,
          status: 'PENDING' as const,
        })),
      ),
    ],
  };
}
export function decideProductApproval(
  state: WorkbenchState,
  assignmentId: string,
  actor: string,
  decision: 'APPROVED' | 'REJECTED',
  comment: string,
): WorkbenchState {
  const assignment = state.approvalAssignments.find(
    (row) => row.id === assignmentId,
  );
  const step = state.approvalSteps.find(
    (row) => row.id === assignment?.approvalRequestStepId,
  );
  const request = state.approvalRequests.find(
    (row) => row.id === step?.approvalRequestId,
  );
  requireCondition(
    assignment &&
      step &&
      request &&
      assignment.status === 'PENDING' &&
      step.status === 'PENDING' &&
      request.status === 'PENDING',
    '현재 진행 중인 승인 단계가 아닙니다.',
  );
  requireCondition(
    assignment.assignedTo === actor && authorized(state, actor, step.type),
    '배정받은 승인자와 유효한 단계별 권한이 필요합니다.',
  );
  requireCondition(
    decision !== 'REJECTED' || comment.trim(),
    '반려 사유를 입력하세요.',
  );
  if (decision === 'APPROVED') {
    requireCondition(
      request.submittedData.snapshot ===
        registrationSnapshot(state, request.entityId),
      '상신 이후 제품 정보가 변경되었습니다. 반려 후 다시 상신하세요.',
    );
    validateProducts(state, request.submittedData.productIds);
  }
  const now = new Date().toISOString();
  const assignments = state.approvalAssignments.map((row) =>
    row.id === assignment.id
      ? {
          ...row,
          status: decision,
          decidedBy: actor,
          decidedAt: now,
          comment: comment.trim(),
        }
      : row,
  );
  const allApproved = assignments
    .filter((row) => row.approvalRequestStepId === step.id)
    .every((row) => row.status === 'APPROVED');
  const final = decision === 'APPROVED' && allApproved && step.type === 'FINAL';
  const rejected = decision === 'REJECTED';
  const nextStep = state.approvalSteps
    .filter(
      (row) =>
        row.approvalRequestId === request.id &&
        row.stepNumber > step.stepNumber,
    )
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .find((row) => row.status === 'WAITING');
  const relatedSteps = new Set(
    state.approvalSteps
      .filter((row) => row.approvalRequestId === request.id)
      .map((row) => row.id),
  );
  return {
    ...state,
    approvalAssignments: assignments.map((row) =>
      rejected &&
      relatedSteps.has(row.approvalRequestStepId) &&
      row.status === 'PENDING'
        ? { ...row, status: 'CANCELLED' }
        : row,
    ),
    approvalSteps: state.approvalSteps.map((row) =>
      row.id === step.id && (allApproved || rejected)
        ? { ...row, status: rejected ? 'REJECTED' : 'APPROVED', closedAt: now }
        : rejected && relatedSteps.has(row.id) && row.status === 'WAITING'
          ? { ...row, status: 'CANCELLED', closedAt: now }
          : allApproved && row.id === nextStep?.id
            ? { ...row, status: 'PENDING', activatedAt: now }
            : row,
    ),
    approvalRequests: state.approvalRequests.map((row) =>
      row.id === request.id && (final || rejected)
        ? { ...row, status: rejected ? 'REJECTED' : 'APPROVED', closedAt: now }
        : row,
    ),
    masterProducts: state.masterProducts.map((row) =>
      final && request.submittedData.productIds.includes(row.id)
        ? { ...row, status: 'ACTIVE', updatedAt: now }
        : row,
    ),
    masterProductSkus: final
      ? [
          ...state.masterProductSkus,
          ...state.masterProducts
            .filter((row) => request.submittedData.productIds.includes(row.id))
            .map((row) => ({
              id: crypto.randomUUID(),
              masterProductId: row.id,
              sku: row.sku,
              validFrom: now,
              note: '최종 승인',
            })),
        ]
      : state.masterProductSkus,
    uniqueVehicles: state.uniqueVehicles.map((vehicle) =>
      final &&
      state.masterProducts.some(
        (row) =>
          request.submittedData.productIds.includes(row.id) &&
          row.fNumber === vehicle.fNumber,
      )
        ? { ...vehicle, skuStatus: 'ACTIVE' }
        : vehicle,
    ),
  };
}

import type { WorkbenchState } from '@/app/workbench-store';
import {
  cancelApproval,
  decideApproval,
  findTask,
  requireCondition,
  submitApproval,
  type ApprovalDecision,
  type ApprovalRoute,
} from './approval/approval-engine';

export type { ApprovalRoute } from './approval/approval-engine';

export const PRODUCT_APPROVAL_TYPE = 'VEHICLE_PRODUCT_REGISTRATION';

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
    'No products to approve, or duplicate products.',
  );
  const skus = new Set<string>();
  for (const id of ids) {
    const product = state.masterProducts.find((row) => row.id === id);
    requireCondition(
      product?.status === 'DRAFT',
      'All target products must be in DRAFT status.',
    );
    const sku = product.sku.trim().toLowerCase();
    requireCondition(sku && !skus.has(sku), 'SKUs are empty or duplicated.');
    skus.add(sku);
    requireCondition(
      !state.masterProductSkus.some(
        (row) => row.sku.trim().toLowerCase() === sku,
      ) &&
        !state.masterProducts.some(
          (row) => row.id !== id && row.sku.trim().toLowerCase() === sku,
        ),
      'Previously used SKUs cannot be issued again.',
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
      'Material and color must match the product type.',
    );
    const shapes = [
      product.exteriorShapeId,
      product.frontShapeId,
      product.rearShapeId,
      product.thirdRowShapeId,
    ].filter((id): id is string => Boolean(id));
    requireCondition(
      shapes.length > 0 || product.vehicleProductDesignId,
      'A product Shape or part reference is required.',
    );
    requireCondition(
      !(shapes.length && product.vehicleProductDesignId),
      'A Shape product and part product cannot both be specified.',
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
      'A confirmed Shape of the same product type is required.',
    );
  }
}

/** Opens the SKU registration sign-off after the products themselves pass validation. */
export function submitProductApproval(
  state: WorkbenchState,
  registrationId: string,
  actor: string,
  route: ApprovalRoute,
  note = '',
): WorkbenchState {
  const registration = state.registrations.find(
    (row) => row.id === registrationId,
  );
  requireCondition(
    registration && !registration.approvedAt,
    'A valid unapproved registration is required.',
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
    'Registration reference Shape not found.',
  );
  return submitApproval(
    state,
    {
      approvalTypeId: PRODUCT_APPROVAL_TYPE,
      entityType: 'VEHICLE_PRODUCT_REGISTRATION',
      entityId: registrationId,
      requestedBy: actor,
      submittedData: {
        productIds,
        sourceShapeIds,
        snapshot: registrationSnapshot(state, registrationId),
      },
      ...(note.trim() ? { note: note.trim() } : {}),
    },
    route,
  );
}

/**
 * One approver's decision on a registration. The final approval activates the
 * products and opens their SKUs in the same update, provided the registration
 * has not changed since submission.
 */
export function decideProductApproval(
  state: WorkbenchState,
  assignmentId: string,
  actor: string,
  decision: ApprovalDecision,
  comment: string,
): WorkbenchState {
  // Authorization and step checks run first so their errors take precedence.
  const result = decideApproval(state, assignmentId, actor, decision, comment);
  const task = findTask(state, assignmentId);
  requireCondition(
    task?.request.entityType === 'VEHICLE_PRODUCT_REGISTRATION',
    'This is not a registration approval.',
  );
  const { submittedData, entityId } = task.request;
  if (decision === 'APPROVED') {
    requireCondition(
      submittedData.snapshot === registrationSnapshot(state, entityId),
      'Product information changed after submission. Reject and resubmit.',
    );
    validateProducts(state, submittedData.productIds);
  }
  if (result.outcome !== 'APPROVED') return result.state;
  const now = new Date().toISOString();
  const approved = result.state.masterProducts.filter((row) =>
    submittedData.productIds.includes(row.id),
  );
  return {
    ...result.state,
    masterProducts: result.state.masterProducts.map((row) =>
      submittedData.productIds.includes(row.id)
        ? { ...row, status: 'ACTIVE', updatedAt: now }
        : row,
    ),
    masterProductSkus: [
      ...result.state.masterProductSkus,
      ...approved.map((row) => ({
        id: crypto.randomUUID(),
        masterProductId: row.id,
        sku: row.sku,
        validFrom: now,
        note: 'Final approval',
      })),
    ],
    uniqueVehicles: result.state.uniqueVehicles.map((vehicle) =>
      approved.some((row) => row.fNumber === vehicle.fNumber)
        ? { ...vehicle, skuStatus: 'ACTIVE' }
        : vehicle,
    ),
  };
}

/** The requester withdraws a pending registration request. */
export function cancelProductApproval(
  state: WorkbenchState,
  requestId: string,
  actor: string,
): WorkbenchState {
  return cancelApproval(state, requestId, actor);
}

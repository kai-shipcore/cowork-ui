export interface ShapeAssignment {
  id: string;
  uniqueVehicleId: string;
  vehicleZoneId: string;
  vehicleProductShapeId: string;
  type: 'PRIMARY' | 'ALTERNATIVE';
  substitutionPriority?: number;
  validFrom: string;
  validTo?: string;
  note?: string;
}

export interface FitmentQuality {
  id: string;
  vehicleResearchId: string;
  vehicleProjectId: string;
  vehicleProductDesignId?: string;
  vehicleZoneId?: string;
  sampleRequestItemId?: string;
  fieldVisitProjectId?: string;
  quality: 'PASS' | 'FAIL';
  source: 'FITTING' | 'REVIEW';
  note: string;
  evidenceKey: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectStageRecord {
  id: string;
  stage: string;
  stageSequence: number;
  startedAt: string;
  startedBy?: string;
  completedAt?: string;
  completedBy?: string;
  targetDays?: number;
  targetDueAt?: string;
  templateRevisionId?: string;
}

/** `approval_type`: a kind of sign-off a feature refers to by its stable code. */
export interface ApprovalType {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}
/** ALL: everyone in the step must approve. ANY: the first decision settles the step. */
export type ApprovalCompletionRule = 'ALL' | 'ANY';
export interface ApprovalGrant {
  id: string;
  appUserId: string;
  approvalTypeId: string;
  canForward: boolean;
  canFinalApprove: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}
export interface ApprovalAssignment {
  id: string;
  approvalRequestStepId: string;
  assignedTo: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
}
export interface ApprovalStep {
  id: string;
  approvalRequestId: string;
  stepNumber: number;
  type: 'FORWARD' | 'FINAL';
  /** Absent on steps recorded before the rule existed; read as ALL. */
  completionRule?: ApprovalCompletionRule;
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  activatedAt?: string;
  closedAt?: string;
}
interface ApprovalRequestBase {
  id: string;
  approvalTypeId: string;
  entityId: string;
  requestedBy: string;
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  closedAt?: string;
}
/** Sign-off on a bundle of new SKUs; the snapshot guards against edits after submission. */
export interface RegistrationApprovalRequest extends ApprovalRequestBase {
  entityType: 'VEHICLE_PRODUCT_REGISTRATION';
  submittedData: {
    productIds: readonly string[];
    sourceShapeIds: readonly string[];
    snapshot: string;
  };
}
/** Sign-off on taking a completed research combination into development. */
export interface ResearchApprovalRequest extends ApprovalRequestBase {
  entityType: 'VEHICLE_RESEARCH';
  submittedData: {
    snapshot: string;
  };
}
export type ApprovalRequest =
  RegistrationApprovalRequest | ResearchApprovalRequest;

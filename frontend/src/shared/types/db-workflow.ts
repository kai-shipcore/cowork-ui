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
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  activatedAt?: string;
  closedAt?: string;
}
export interface ApprovalRequest {
  id: string;
  approvalTypeId: string;
  entityType: 'VEHICLE_PRODUCT_REGISTRATION';
  entityId: string;
  requestedBy: string;
  submittedData: {
    productIds: readonly string[];
    sourceShapeIds: readonly string[];
    snapshot: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  closedAt?: string;
}

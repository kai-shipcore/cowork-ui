import { ApprovalRequestPanel } from '@/shared/domain/approval/approval-request-panel';
import { useApprovalActor } from '@/shared/domain/approval/use-approval-actor';
import { useApprovalTransform } from '@/shared/domain/approval/use-approval-transform';
import {
  cancelProductApproval,
  decideProductApproval,
  PRODUCT_APPROVAL_TYPE,
  submitProductApproval,
} from '@/shared/domain/product-approval';
import { useWorkbenchStore } from '@/app/workbench-store';

interface ProductApprovalPanelProps {
  registrationId: string;
  /** Open the submit dialog right away, for the list's "Submit for approval" action. */
  initialSubmitOpen?: boolean;
}

/** SKU registration sign-off: the shared approval panel bound to the registration domain. */
export function ProductApprovalPanel({
  registrationId,
  initialSubmitOpen = false,
}: ProductApprovalPanelProps) {
  const { approvalRequests, registrations, registrationItems, masterProducts } =
    useWorkbenchStore();
  const actorId = useApprovalActor();
  const apply = useApprovalTransform();
  const requests = approvalRequests
    .filter(
      (row) =>
        row.entityType === 'VEHICLE_PRODUCT_REGISTRATION' &&
        row.entityId === registrationId,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const current = requests.slice(-1).pop();
  const registration = registrations.find((row) => row.id === registrationId);
  const skus = registrationItems
    .filter((item) => item.registrationId === registrationId)
    .map(
      (item) =>
        masterProducts.find((product) => product.id === item.masterProductId)
          ?.sku ?? item.masterProductId,
    );
  const canSubmit =
    registration !== undefined &&
    !registration.approvedAt &&
    (!current ||
      current.status === 'REJECTED' ||
      current.status === 'CANCELLED');

  return (
    <ApprovalRequestPanel
      approvalTypeId={PRODUCT_APPROVAL_TYPE}
      requests={requests}
      canSubmit={canSubmit}
      blockedMessage={
        registration?.approvedAt
          ? `Approved on ${registration.approvedAt.slice(0, 10)}, before step-by-step approvals existed. No route history is available.`
          : undefined
      }
      submitTitle={`Submit ${registrationId} for approval`}
      submitSummary={
        <div className="approval-submit-summary">
          <strong>
            {skus.length} SKU{skus.length === 1 ? '' : 's'} in this registration
          </strong>
          <span>{skus.join(', ') || 'No products attached'}</span>
        </div>
      }
      initialSubmitOpen={initialSubmitOpen}
      onSubmit={(route, note) =>
        apply((latest) =>
          submitProductApproval(latest, registrationId, actorId, route, note),
        )
      }
      onDecide={(assignmentId, decision, comment) =>
        apply((latest) =>
          decideProductApproval(
            latest,
            assignmentId,
            actorId,
            decision,
            comment,
          ),
        )
      }
      onCancel={(requestId) =>
        apply((latest) => cancelProductApproval(latest, requestId, actorId))
      }
    />
  );
}

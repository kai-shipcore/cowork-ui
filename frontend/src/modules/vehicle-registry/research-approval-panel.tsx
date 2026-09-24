import { Button } from '@coverland-engineering/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { ApprovalRequestPanel } from '@/shared/domain/approval/approval-request-panel';
import { useApprovalActor } from '@/shared/domain/approval/use-approval-actor';
import { useApprovalTransform } from '@/shared/domain/approval/use-approval-transform';
import { ConfigChips } from '@/shared/domain/config-chips';
import {
  cancelResearchApproval,
  decideResearchApproval,
  RESEARCH_APPROVAL_TYPE,
  researchRequestsFor,
  submitResearchApproval,
} from '@/shared/domain/research-approval';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';

interface ResearchApprovalPanelProps {
  configuration: VehicleConfiguration;
  initialSubmitOpen?: boolean;
}

/**
 * "Research complete: do we develop this combination?" The shared approval
 * panel bound to the research handoff domain. Approval pushes the combination
 * to development; rejection holds it with the approver's reason.
 */
export function ResearchApprovalPanel({
  configuration,
  initialSubmitOpen = false,
}: ResearchApprovalPanelProps) {
  const { approvalRequests, setConfigurations } = useWorkbenchStore();
  const actorId = useApprovalActor();
  const apply = useApprovalTransform();
  const requests = researchRequestsFor(approvalRequests, configuration.id);
  const current = requests.slice(-1).pop();
  const isComplete = ['COMPLETE', 'COMPLETED'].includes(
    configuration.researchStatus,
  );
  const canSubmit =
    isComplete &&
    (!current ||
      current.status === 'REJECTED' ||
      current.status === 'CANCELLED');

  function completeResearch(): void {
    setConfigurations((rows) =>
      rows.map((row) =>
        row.id === configuration.id
          ? { ...row, researchStatus: 'COMPLETED' }
          : row,
      ),
    );
  }

  return (
    <ApprovalRequestPanel
      approvalTypeId={RESEARCH_APPROVAL_TYPE}
      requests={requests}
      canSubmit={canSubmit}
      blockedMessage="Research must be complete before asking whether this combination goes to development."
      emptyAction={
        !isComplete && (
          <Button variant="outline" onClick={completeResearch}>
            <CheckCircle2 /> Mark research complete
          </Button>
        )
      }
      submitTitle={`Request project handoff · ${configuration.id}`}
      submitSummary={
        <div className="approval-submit-summary">
          <strong>{configuration.vehicle}</strong>
          <ConfigChips options={configuration.options} />
          <span>
            Approval pushes this combination to development. A rejection puts it
            on hold with the approver's reason.
          </span>
        </div>
      }
      initialSubmitOpen={initialSubmitOpen}
      onSubmit={(route, note) =>
        apply((latest) =>
          submitResearchApproval(
            latest,
            configuration.id,
            actorId,
            route,
            note,
          ),
        )
      }
      onDecide={(assignmentId, decision, comment) =>
        apply((latest) =>
          decideResearchApproval(
            latest,
            assignmentId,
            actorId,
            decision,
            comment,
          ),
        )
      }
      onCancel={(requestId) =>
        apply((latest) => cancelResearchApproval(latest, requestId, actorId))
      }
    />
  );
}

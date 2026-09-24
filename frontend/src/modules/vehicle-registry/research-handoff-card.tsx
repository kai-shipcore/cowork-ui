import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { GitPullRequest } from 'lucide-react';
import { ConfigChips } from '@/shared/domain/config-chips';
import {
  RESEARCH_DISPOSITION_LABELS,
  RESEARCH_DISPOSITION_TONES,
  researchDisposition,
} from '@/shared/domain/research-approval';
import { StatusBadge } from '@/shared/components/status-badge';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ResearchApprovalPanel } from './research-approval-panel';
import './research-handoff-card.css';

interface ResearchHandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuration: VehicleConfiguration | null;
  sourceConfigurationId?: string;
  productLabel?: string;
  configurationNumber?: number;
}

/** Approval workflow for one product research configuration. */
export function ResearchHandoffDialog({
  open,
  onOpenChange,
  configuration,
  sourceConfigurationId,
  productLabel,
  configurationNumber,
}: ResearchHandoffDialogProps) {
  const { approvalRequests } = useWorkbenchStore();
  if (!configuration) return null;

  const disposition = researchDisposition(approvalRequests, configuration);
  const complete = ['COMPLETE', 'COMPLETED'].includes(
    configuration.researchStatus,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="research-handoff-dialog">
        <DialogHeader>
          <DialogTitle>Project handoff approval</DialogTitle>
          <p>
            Review whether this completed product research configuration should
            become a project.
          </p>
        </DialogHeader>
        <DialogBody>
          <section className="research-handoff-summary">
            <span aria-hidden="true">
              <GitPullRequest />
            </span>
            <div>
              <small>RESEARCH CONFIGURATION</small>
              <h3>
                {productLabel ?? 'Product'}
                {configurationNumber
                  ? ` · Configuration ${String(configurationNumber)}`
                  : ''}
              </h3>
              <p>{configuration.vehicle}</p>
              <ConfigChips options={configuration.options} />
            </div>
            <div className="research-handoff-summary-statuses">
              <StatusBadge
                label={complete ? 'Completed' : 'In progress'}
                tone={complete ? 'success' : 'progress'}
              />
              <StatusBadge
                label={RESEARCH_DISPOSITION_LABELS[disposition]}
                tone={RESEARCH_DISPOSITION_TONES[disposition]}
              />
            </div>
          </section>
          <ResearchApprovalPanel
            configuration={configuration}
            sourceConfigurationId={sourceConfigurationId}
            productLabel={productLabel}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

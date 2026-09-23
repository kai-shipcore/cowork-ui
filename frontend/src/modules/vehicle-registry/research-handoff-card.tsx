import { useState } from 'react';
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

interface ResearchHandoffCardProps {
  /** Every option combination researched for this make/model. */
  configurations: readonly VehicleConfiguration[];
  /** The combination the page was opened for; expanded by default. */
  selectedId: string;
}

/**
 * Per option combination: research progress, the handoff disposition, and the
 * approval panel for the selected one. Complete never means development by
 * itself; the approvers decide push or hold for each combination.
 */
export function ResearchHandoffCard({
  configurations,
  selectedId,
}: ResearchHandoffCardProps) {
  const { approvalRequests } = useWorkbenchStore();
  const [openId, setOpenId] = useState(selectedId);
  const open = configurations.find((row) => row.id === openId);

  return (
    <section className="research-detail-card decision-card research-handoff-card">
      <div className="section-heading">
        <div>
          <span aria-hidden="true">
            <GitPullRequest />
          </span>
          <h2>Project handoff approval</h2>
        </div>
        <p>
          Research completion and the decision to develop are separate. Each
          combination asks its approvers whether it becomes a project.
        </p>
      </div>
      <ul className="research-handoff-list" aria-label="Option combinations">
        {configurations.map((configuration) => {
          const disposition = researchDisposition(
            approvalRequests,
            configuration,
          );
          return (
            <li key={configuration.id}>
              <button
                type="button"
                className="research-handoff-row"
                aria-expanded={openId === configuration.id}
                onClick={() => {
                  setOpenId(configuration.id);
                }}
              >
                <span className="research-handoff-id">{configuration.id}</span>
                <ConfigChips options={configuration.options} />
                <span className="research-handoff-badges">
                  <StatusBadge
                    label={
                      configuration.researchStatus === 'COMPLETE'
                        ? 'Complete'
                        : 'Researching'
                    }
                    tone={
                      configuration.researchStatus === 'COMPLETE'
                        ? 'success'
                        : 'progress'
                    }
                  />
                  <StatusBadge
                    label={RESEARCH_DISPOSITION_LABELS[disposition]}
                    tone={RESEARCH_DISPOSITION_TONES[disposition]}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <ResearchApprovalPanel key={open.id} configuration={open} />}
    </section>
  );
}

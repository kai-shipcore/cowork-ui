import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Route, Save } from 'lucide-react';
import {
  newRouteStep,
  validateRoute,
  type ApprovalRouteStepDraft,
} from '@/shared/domain/approval/approval-model';
import { ApprovalRouteBuilder } from '@/shared/domain/approval/approval-route-builder';
import {
  templateSteps,
  withTemplate,
} from '@/shared/domain/approval/approval-route-template';
import { useApprovalRouteTemplates } from '@/shared/domain/approval/use-approval-route-templates';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import './admin.css';
import '@/shared/domain/approval/approval.css';

interface ApprovalRouteTemplateCardProps {
  approvalTypeId: string;
}

/**
 * The default approval steps for one type: which reviewers, which final
 * approvers, and each step's completion rule. New requests of this type start
 * from these steps.
 */
export function ApprovalRouteTemplateCard({
  approvalTypeId,
}: ApprovalRouteTemplateCardProps) {
  const { appUsers, approvalGrants, approvalTypes } = useWorkbenchStore();
  const { actor } = useOperations();
  const templates = useApprovalRouteTemplates();
  const saved = templates.records.find(
    (row) => row.approvalTypeId === approvalTypeId,
  );
  const [steps, setSteps] = useState<readonly ApprovalRouteStepDraft[]>(
    () =>
      templateSteps(templates.records, approvalTypeId) ?? [
        newRouteStep('FINAL'),
      ],
  );
  const [message, setMessage] = useState('');
  const type = approvalTypes.find((row) => row.id === approvalTypeId);
  const error = validateRoute(steps, appUsers, approvalGrants, approvalTypeId);

  function save(): void {
    void templates
      .save((current) =>
        withTemplate(current, approvalTypeId, steps, actor.name),
      )
      .then((ok) => {
        setMessage(
          ok
            ? 'Default route saved. New requests of this type start from it.'
            : templates.error,
        );
      });
  }

  function clear(): void {
    void templates
      .save((current) =>
        current.filter((row) => row.approvalTypeId !== approvalTypeId),
      )
      .then((ok) => {
        if (!ok) return;
        setSteps([newRouteStep('FINAL')]);
        setMessage(
          'Default route removed. Submitters build the route themselves.',
        );
      });
  }

  return (
    <section className="admin-card" aria-labelledby="approval-route-title">
      <header>
        <div>
          <h2 id="approval-route-title">
            Default approval steps · {type?.name ?? approvalTypeId}
          </h2>
          <p>
            Review steps first, then the final approval. Only people holding a
            grant for the step can be chosen. The request screen pre-fills these
            steps; the submitter can still adjust before sending, and a
            submitted route never changes.
          </p>
        </div>
        <span className="admin-badge">
          <Route aria-hidden="true" size={13} />
          {saved
            ? `Saved ${saved.updatedAt.slice(0, 10)} by ${saved.updatedBy}`
            : 'No default yet'}
        </span>
      </header>
      <ApprovalRouteBuilder
        users={appUsers}
        grants={approvalGrants}
        approvalTypeId={approvalTypeId}
        requesterId=""
        steps={steps}
        onChange={(next) => {
          setSteps(next);
          setMessage('');
        }}
      />
      {error && (
        <p role="alert" className="approval-error">
          {error}
        </p>
      )}
      <div className="admin-actions">
        <Button
          type="button"
          variant="primary"
          disabled={error !== undefined || templates.saving}
          onClick={save}
        >
          <Save /> Save default route
        </Button>
        {saved && (
          <Button type="button" variant="ghost" onClick={clear}>
            Remove default
          </Button>
        )}
      </div>
      <p role="status" className="admin-status admin-muted">
        {message}
      </p>
    </section>
  );
}

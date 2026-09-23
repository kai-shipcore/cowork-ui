import { Check, Clock3, Minus, X } from 'lucide-react';
import { StatusBadge } from '@/shared/components/status-badge';
import type {
  ApprovalAssignment,
  ApprovalRequest,
  ApprovalStep,
} from '@/shared/types/db-workflow';
import type { AppUser } from '@/shared/types/workbench';
import { UserAvatar } from '../user-picker';
import {
  ASSIGNMENT_STATUS_TONES,
  describeStep,
  STEP_TYPE_LABELS,
  userLabel,
} from './approval-model';

interface ApprovalRouteStepperProps {
  request: ApprovalRequest;
  steps: readonly ApprovalStep[];
  assignments: readonly ApprovalAssignment[];
  users: readonly AppUser[];
}

const STEP_ICONS = {
  WAITING: Clock3,
  PENDING: Clock3,
  APPROVED: Check,
  REJECTED: X,
  CANCELLED: Minus,
} as const;

const ASSIGNMENT_LABELS = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Not needed',
} as const;

/** The frozen route of one request with every person's state inside each step. */
export function ApprovalRouteStepper({
  request,
  steps,
  assignments,
  users,
}: ApprovalRouteStepperProps) {
  const route = steps
    .filter((step) => step.approvalRequestId === request.id)
    .sort((a, b) => a.stepNumber - b.stepNumber);
  return (
    <ol className="approval-stepper" aria-label="Approval route">
      {route.map((step) => {
        const Icon = STEP_ICONS[step.status];
        const people = assignments.filter(
          (row) => row.approvalRequestStepId === step.id,
        );
        return (
          <li
            className="approval-stepper-step"
            data-status={step.status}
            key={step.id}
          >
            <div className="approval-stepper-marker" aria-hidden="true">
              <Icon />
            </div>
            <div className="approval-stepper-body">
              <header>
                <strong>
                  Step {step.stepNumber} · {STEP_TYPE_LABELS[step.type]}
                </strong>
                <small>
                  {step.status === 'WAITING'
                    ? 'Not started'
                    : step.status === 'PENDING'
                      ? 'In progress'
                      : step.status.charAt(0) +
                        step.status.slice(1).toLowerCase()}
                </small>
              </header>
              <p>
                {describeStep(
                  {
                    type: step.type,
                    completionRule: step.completionRule ?? 'ALL',
                    userIds: people.map((row) => row.assignedTo),
                  },
                  users,
                )}
              </p>
              <ul className="approval-assignees">
                {people.map((assignment) => {
                  const user = users.find(
                    (row) => row.id === assignment.assignedTo,
                  );
                  return (
                    <li className="approval-assignee" key={assignment.id}>
                      {user && <UserAvatar user={user} size="sm" />}
                      <span>{userLabel(users, assignment.assignedTo)}</span>
                      <StatusBadge
                        label={ASSIGNMENT_LABELS[assignment.status]}
                        tone={ASSIGNMENT_STATUS_TONES[assignment.status]}
                      />
                      {assignment.decidedAt && (
                        <time dateTime={assignment.decidedAt}>
                          {assignment.decidedAt.slice(0, 16).replace('T', ' ')}
                        </time>
                      )}
                      {assignment.comment && <q>{assignment.comment}</q>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

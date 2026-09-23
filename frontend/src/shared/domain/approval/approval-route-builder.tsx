import { Button } from '@coverland-engineering/ui/button';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ApprovalGrant } from '@/shared/types/db-workflow';
import type { AppUser } from '@/shared/types/workbench';
import { UserAvatar } from '../user-picker';
import {
  describeStep,
  grantedUsers,
  newRouteStep,
  routePresets,
  STEP_TYPE_LABELS,
  type ApprovalRouteStepDraft,
} from './approval-model';

interface ApprovalRouteBuilderProps {
  users: readonly AppUser[];
  grants: readonly ApprovalGrant[];
  approvalTypeId: string;
  /** The submitter; a step that includes them gets a self-approval note. */
  requesterId: string;
  steps: readonly ApprovalRouteStepDraft[];
  onChange: (steps: readonly ApprovalRouteStepDraft[]) => void;
}

/**
 * Composes the route for one request: optional review steps, then the fixed
 * final step. People come from the grant list for the step's action, so an
 * ungranted assignee cannot be chosen.
 */
export function ApprovalRouteBuilder({
  users,
  grants,
  approvalTypeId,
  requesterId,
  steps,
  onChange,
}: ApprovalRouteBuilderProps) {
  const forwarders = grantedUsers(users, grants, approvalTypeId, 'FORWARD');
  const finalApprovers = grantedUsers(users, grants, approvalTypeId, 'FINAL');
  const presets = routePresets(forwarders, finalApprovers);
  const reviewSteps = steps.filter((step) => step.type === 'FORWARD');
  const finalStep =
    steps.find((step) => step.type === 'FINAL') ?? newRouteStep('FINAL');

  function commit(
    review: readonly ApprovalRouteStepDraft[],
    final: ApprovalRouteStepDraft,
  ): void {
    onChange([...review, final]);
  }

  function updateStep(
    stepId: string,
    patch: Partial<ApprovalRouteStepDraft>,
  ): void {
    const apply = (step: ApprovalRouteStepDraft) =>
      step.id === stepId ? { ...step, ...patch } : step;
    commit(reviewSteps.map(apply), apply(finalStep));
  }

  function togglePerson(step: ApprovalRouteStepDraft, userId: string): void {
    updateStep(step.id, {
      userIds: step.userIds.includes(userId)
        ? step.userIds.filter((id) => id !== userId)
        : [...step.userIds, userId],
    });
  }

  function moveReview(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= reviewSteps.length) return;
    const next = [...reviewSteps];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    commit(next, finalStep);
  }

  function renderStep(
    step: ApprovalRouteStepDraft,
    index: number,
    candidates: readonly AppUser[],
  ) {
    const isReview = step.type === 'FORWARD';
    return (
      <li className="approval-step" key={step.id}>
        <header>
          <span className="approval-step-number">{index + 1}</span>
          <strong>{STEP_TYPE_LABELS[step.type]}</strong>
          {!isReview && <small>Required · always last</small>}
          {isReview && (
            <div className="approval-step-tools">
              <Button
                mode="icon"
                size="sm"
                variant="ghost"
                aria-label={`Move step ${String(index + 1)} up`}
                disabled={index === 0}
                onClick={() => {
                  moveReview(index, -1);
                }}
              >
                <ArrowUp />
              </Button>
              <Button
                mode="icon"
                size="sm"
                variant="ghost"
                aria-label={`Move step ${String(index + 1)} down`}
                disabled={index === reviewSteps.length - 1}
                onClick={() => {
                  moveReview(index, 1);
                }}
              >
                <ArrowDown />
              </Button>
              <Button
                mode="icon"
                size="sm"
                variant="ghost"
                aria-label={`Remove step ${String(index + 1)}`}
                onClick={() => {
                  commit(
                    reviewSteps.filter((row) => row.id !== step.id),
                    finalStep,
                  );
                }}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        </header>
        <div
          className="approval-step-people"
          role="group"
          aria-label={`Step ${String(index + 1)} people`}
        >
          {candidates.length === 0 && (
            <small>
              No one holds a grant for this step. Ask an approval administrator.
            </small>
          )}
          {candidates.map((user) => {
            const selected = step.userIds.includes(user.id);
            return (
              <button
                type="button"
                className="approval-person-chip"
                key={user.id}
                aria-pressed={selected}
                onClick={() => {
                  togglePerson(step, user.id);
                }}
              >
                <UserAvatar user={user} size="sm" />
                {user.name}
                {user.id === requesterId && <em>you</em>}
              </button>
            );
          })}
        </div>
        {step.userIds.length > 1 && (
          <div
            className="approval-rule"
            role="radiogroup"
            aria-label={`Step ${String(index + 1)} completion rule`}
          >
            <label>
              <input
                type="radio"
                name={`rule-${step.id}`}
                checked={step.completionRule === 'ALL'}
                onChange={() => {
                  updateStep(step.id, { completionRule: 'ALL' });
                }}
              />
              Everyone must approve
            </label>
            <label>
              <input
                type="radio"
                name={`rule-${step.id}`}
                checked={step.completionRule === 'ANY'}
                onChange={() => {
                  updateStep(step.id, { completionRule: 'ANY' });
                }}
              />
              First decision counts
            </label>
          </div>
        )}
        <p className="approval-step-summary">{describeStep(step, users)}</p>
        {step.userIds.includes(requesterId) && (
          <p className="approval-step-warning">
            You are among the approvers of this step (self-approval is allowed).
          </p>
        )}
      </li>
    );
  }

  return (
    <div className="approval-route-builder">
      <div className="approval-presets" role="group" aria-label="Route presets">
        {presets.map((preset) => (
          <button
            type="button"
            className="approval-preset"
            key={preset.id}
            title={preset.description}
            onClick={() => {
              onChange(preset.steps);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <ol className="approval-steps">
        {reviewSteps.map((step, index) => renderStep(step, index, forwarders))}
        <li className="approval-add-step">
          <Button
            variant="dashed"
            size="sm"
            onClick={() => {
              commit([...reviewSteps, newRouteStep('FORWARD')], finalStep);
            }}
          >
            <Plus /> Add review step
          </Button>
        </li>
        {renderStep(finalStep, reviewSteps.length, finalApprovers)}
      </ol>
      <p className="approval-route-note">
        The route is frozen once submitted. To change it, cancel the request and
        submit again.
      </p>
    </div>
  );
}

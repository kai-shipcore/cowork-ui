import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { Check, X } from 'lucide-react';
import { describeDecisionEffect, type PendingTask } from './approval-model';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

interface ApprovalDecisionPanelProps {
  task: PendingTask;
  /** Shown above the buttons when the caller refused the last decision. */
  error?: string;
  onDecide: (decision: ApprovalDecision, comment: string) => void;
}

/**
 * The approver's controls for their own pending task: what the decision does,
 * a comment, Approve, Reject. Rejecting without a comment asks once, since the
 * comment is the only explanation the requester gets.
 */
export function ApprovalDecisionPanel({
  task,
  error,
  onDecide,
}: ApprovalDecisionPanelProps) {
  const [comment, setComment] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);

  function decide(decision: ApprovalDecision): void {
    onDecide(decision, comment.trim());
    setComment('');
  }

  return (
    <section className="approval-decision" aria-labelledby="approval-decision">
      <h3 id="approval-decision">Your decision</h3>
      <p>{describeDecisionEffect(task)}</p>
      <label>
        Comment
        <textarea
          rows={2}
          maxLength={2000}
          value={comment}
          placeholder="Optional for approval; the requester reads this on rejection"
          onChange={(event) => {
            setComment(event.target.value);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="approval-error">
          {error}
        </p>
      )}
      <div className="approval-decision-actions">
        <Button
          variant="destructive"
          onClick={() => {
            if (comment.trim()) decide('REJECTED');
            else setConfirmReject(true);
          }}
        >
          <X /> Reject
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            decide('APPROVED');
          }}
        >
          <Check /> Approve
        </Button>
      </div>
      <Dialog open={confirmReject} onOpenChange={setConfirmReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject without a reason?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="dialog-note">
              The comment is the only explanation the requester receives. Add
              one, or reject anyway.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmReject(false);
              }}
            >
              Add a comment
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmReject(false);
                decide('REJECTED');
              }}
            >
              Reject anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

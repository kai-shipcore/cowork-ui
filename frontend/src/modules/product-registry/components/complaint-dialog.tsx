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
import { Input } from '@coverland-engineering/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@coverland-engineering/ui/select';
import { Textarea } from '@coverland-engineering/ui/textarea';
import type { UniqueVehicle } from '@/shared/types/workbench';

/** What the operator typed; the F# context comes from the selected row. */
export interface ComplaintDraft {
  issue: string;
  design: string;
  revision: string;
  owner: string;
}

interface ComplaintDialogProps {
  vehicle: UniqueVehicle;
  /** Shape names assigned to this F#, offered as the affected design. */
  designOptions: readonly string[];
  /** Pre-filled owner, normally the signed-in user. */
  defaultOwner: string;
  onSubmit: (draft: ComplaintDraft) => void;
  onClose: () => void;
}

const NO_DESIGN = 'Not assigned';

/**
 * Records a fitting complaint against one F#.
 *
 * The complaint text is the point of the form: without it the record cannot
 * say what went wrong, so it is required. Design, revision, and owner are
 * pre-filled from the row but stay editable, because the reported problem is
 * often on a different shape or revision than the first one listed.
 */
export function ComplaintDialog({
  vehicle,
  designOptions,
  defaultOwner,
  onSubmit,
  onClose,
}: ComplaintDialogProps) {
  const [issue, setIssue] = useState('');
  const [design, setDesign] = useState(designOptions[0] ?? NO_DESIGN);
  const [revision, setRevision] = useState('Rev 1');
  const [owner, setOwner] = useState(defaultOwner);
  const canSubmit = Boolean(issue.trim() && owner.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>컴플레인 접수</DialogTitle>
        </DialogHeader>
        <DialogBody className="dialog-form-grid">
          <div className="dialog-vehicle-summary full-width">
            <span>
              {vehicle.product} · {vehicle.fNumber}
            </span>
            <strong>{vehicle.vehicle}</strong>
          </div>
          <label className="full-width">
            문제 내용
            <Textarea
              value={issue}
              placeholder="고객이 보고한 증상과 확인된 부위를 적어 주세요."
              onChange={(event) => setIssue(event.target.value)}
            />
          </label>
          <label>
            대상 Design
            {designOptions.length ? (
              <Select value={design} onValueChange={setDesign}>
                <SelectTrigger aria-label="대상 Design">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {designOptions.map((option) => (
                    <SelectItem value={option} key={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={NO_DESIGN} readOnly />
            )}
          </label>
          <label>
            Revision
            <Input
              value={revision}
              onChange={(event) => setRevision(event.target.value)}
            />
          </label>
          <label>
            담당자
            <Input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                issue: issue.trim(),
                design: designOptions.length ? design : NO_DESIGN,
                revision: revision.trim() || 'Rev 1',
                owner: owner.trim(),
              })
            }
          >
            접수
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

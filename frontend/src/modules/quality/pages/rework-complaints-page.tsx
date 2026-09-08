import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@coverland-engineering/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coverland-engineering/ui/dialog';
import { Input } from '@coverland-engineering/ui/input';
import { Textarea } from '@coverland-engineering/ui/textarea';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import type { Complaint } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';

/** Complaint intake and append-only rework workflow. */
export function ReworkComplaintsPage() {
  const { complaints, setComplaints, uniqueVehicles } = useWorkbenchStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [complaintFNumber, setComplaintFNumber] = useState('F#20855');
  const [complaintOwner, setComplaintOwner] = useState('Kai');
  const [complaintIssue, setComplaintIssue] = useState(
    'Customer reported a fitting issue.',
  );

  function addMockComplaint(): void {
    const target = uniqueVehicles.find(
      (vehicle) => vehicle.fNumber === complaintFNumber,
    );
    const nextNumber =
      Math.max(
        0,
        ...complaints.map((item) => Number(item.id.replace(/\D/g, ''))),
      ) + 1;
    const complaint: Complaint = {
      id: `CP-${String(nextNumber).padStart(4, '0')}`,
      fNumber: complaintFNumber,
      vehicle: target?.vehicle ?? 'Vehicle not found',
      product: target?.product ?? 'Seat Cover',
      issue: complaintIssue.trim(),
      design: target?.shapes[0] ?? 'Not assigned',
      revision: 'Rev 1',
      reported: new Date().toISOString().slice(0, 10),
      owner: complaintOwner.trim(),
      status: 'OPEN',
    };
    setComplaints((current) => [complaint, ...current]);
    setDialogOpen(false);
  }

  const openComplaints = complaints.filter(
    (complaint) => complaint.status !== 'RESOLVED',
  );
  const resolvedComplaints = complaints.filter(
    (complaint) => complaint.status === 'RESOLVED',
  );

  return (
    <section>
      <PageHeader
        description="원칙: 새 행들의 연쇄 — 어떤 행의 수정도 아님 · 검증 피팅 → design 특정 → Revision N+1 → 재샘플 → 재피팅 → 종결"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'vehicle_product_design_revision' },
                { name: 'vehicle_product_design' },
                { name: 'field_visit_x_vehicle_project' },
                { name: 'complaint', proposed: true },
              ]
            : undefined
        }
        actions={
          <>
            <Button variant="outline">레거시 접합 — 소급 생성</Button>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              <Plus /> 컴플레인 접수
            </Button>
          </>
        }
      />
      <div className="section-heading">
        <h2>진행중</h2>
        <span>{openComplaints.length}</span>
      </div>
      <div className="complaint-list">
        {openComplaints.map((complaint) => (
          <ComplaintCard
            complaint={complaint}
            key={complaint.id}
            onResolve={() =>
              setComplaints((current) =>
                current.map((item) =>
                  item.id === complaint.id
                    ? { ...item, status: 'RESOLVED' }
                    : item,
                ),
              )
            }
          />
        ))}
      </div>
      <div className="section-heading secondary">
        <h2>종결</h2>
        <span>{resolvedComplaints.length}</span>
      </div>
      <div className="complaint-list">
        {resolvedComplaints.map((complaint) => (
          <ComplaintCard complaint={complaint} key={complaint.id} />
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>컴플레인 접수</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              대상 F#
              <Input
                value={complaintFNumber}
                onChange={(event) => setComplaintFNumber(event.target.value)}
              />
            </label>
            <label>
              담당자
              <Input
                value={complaintOwner}
                onChange={(event) => setComplaintOwner(event.target.value)}
              />
            </label>
            <label className="full-width">
              문제 내용
              <Textarea
                value={complaintIssue}
                onChange={(event) => setComplaintIssue(event.target.value)}
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              disabled={
                !complaintFNumber.trim() ||
                !complaintOwner.trim() ||
                !complaintIssue.trim()
              }
              onClick={addMockComplaint}
            >
              접수
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

interface ComplaintCardProps {
  complaint: Complaint;
  onResolve?: () => void;
}

function ComplaintCard({ complaint, onResolve }: ComplaintCardProps) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            {complaint.id} · {complaint.vehicle}
          </CardTitle>
          <p className="vehicle-meta">
            {complaint.fNumber} · {complaint.product} · 접수{' '}
            {complaint.reported}
          </p>
        </div>
        <StatusBadge
          label={
            complaint.status === 'REWORK'
              ? 'Rework 진행'
              : complaint.status === 'OPEN'
                ? '접수됨'
                : '해결 — 종결'
          }
          tone={
            complaint.status === 'REWORK'
              ? 'danger'
              : complaint.status === 'OPEN'
                ? 'warning'
                : 'success'
          }
        />
      </CardHeader>
      <CardContent>
        <p className="complaint-issue">“{complaint.issue}”</p>
        <div className="rework-flow">
          <span>1 검증 피팅</span>
          <span>2 Design 특정</span>
          <span className={complaint.status === 'REWORK' ? 'active' : ''}>
            3 {complaint.revision}
          </span>
          <span>4 재샘플</span>
          <span>5 재피팅</span>
          <span>6 종결</span>
        </div>
        <div className="complaint-meta">
          <div>
            <small>DESIGN</small>
            <strong>{complaint.design}</strong>
          </div>
          <div>
            <small>REVISION</small>
            <strong>{complaint.revision}</strong>
          </div>
          <div>
            <small>OWNER</small>
            <strong>{complaint.owner}</strong>
          </div>
          <div className="push-right">
            {onResolve && (
              <Button size="sm" variant="primary" onClick={onResolve}>
                Resolve — 종결
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

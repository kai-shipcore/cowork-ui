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
        description="Principle: Append new records, never overwrite history · Verification fitting → Identify design → Revision N+1 → Resample → Refit → Resolve"
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
            <Button variant="outline">Legacy link — Backfilled</Button>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              <Plus /> Log complaint
            </Button>
          </>
        }
      />
      <div className="section-heading">
        <h2>In progress</h2>
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
        <h2>Resolved</h2>
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
            <DialogTitle>Log complaint</DialogTitle>
          </DialogHeader>
          <DialogBody className="dialog-form-grid">
            <label>
              Target F#
              <Input
                value={complaintFNumber}
                onChange={(event) => setComplaintFNumber(event.target.value)}
              />
            </label>
            <label>
              Assignee
              <Input
                value={complaintOwner}
                onChange={(event) => setComplaintOwner(event.target.value)}
              />
            </label>
            <label className="full-width">
              Issue details
              <Textarea
                value={complaintIssue}
                onChange={(event) => setComplaintIssue(event.target.value)}
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelled
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
              Submit
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
            {complaint.fNumber} · {complaint.product} · Reported{' '}
            {complaint.reported}
          </p>
        </div>
        <StatusBadge
          label={
            complaint.status === 'REWORK'
              ? 'Rework in progress'
              : complaint.status === 'OPEN'
                ? 'Received'
                : 'Resolve and close'
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
          <span>1 Verification fitting</span>
          <span>2 Identify design</span>
          <span className={complaint.status === 'REWORK' ? 'active' : ''}>
            3 {complaint.revision}
          </span>
          <span>4 Resample</span>
          <span>5 Refit</span>
          <span>6 Resolve</span>
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
                Resolve and close
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

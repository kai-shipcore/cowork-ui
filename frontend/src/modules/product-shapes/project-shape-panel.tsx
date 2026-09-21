import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import { Input } from '@coverland-engineering/ui/input';
import { format } from 'date-fns';
import { Link } from 'react-router';
import { UserPicker } from '@/shared/domain/user-picker';
import type {
  ProjectDesign,
  ProjectSizeReview,
  ProjectVisit,
  ZoneProject,
} from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import { FitmentQualityPanel } from './fitment-quality-panel';
import { ShapeEditor } from './shape-editor';
import {
  dimensionsLabel,
  hasCurrentFitmentQuality,
  isSizeReviewCurrent,
  latestFitting,
  SHAPE_STATUSES,
  sizeReviewBlockers,
  sizeReviewEvidence,
} from './shape-model';
import './shape-management.css';

interface Props {
  zone: ZoneProject;
  designs: readonly ProjectDesign[];
  visits: readonly ProjectVisit[];
  onReview: (review: ProjectSizeReview) => void;
  onLink: (id: string | undefined) => void;
  onOpenTab: (tab: 'designs' | 'visits' | 'files') => void;
}

export function ProjectShapePanel({
  zone,
  designs,
  visits,
  onReview,
  onLink,
  onOpenTab,
}: Props) {
  const {
    vehicleProductShapes: shapes,
    setVehicleProductShapes,
    appUsers,
    projects,
    fitmentQualities,
  } = useWorkbenchStore();
  const [editor, setEditor] = useState<false | 'NEW' | 'ACTIVATE'>(false);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [blueprint, setBlueprint] = useState(
    zone.sizeReview?.blueprintReference ?? '',
  );
  const [reviewer, setReviewer] = useState(
    zone.sizeReview?.reviewedBy ?? CURRENT_USER_ID,
  );
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [meetingAt, setMeetingAt] = useState(() =>
    format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  );
  const [attendees, setAttendees] = useState({
    designer: '',
    scan: '',
    coordinator: '',
    manual: '',
  });
  const participants = [
    `PM / Director: ${appUsers.find((user) => user.id === reviewer)?.name ?? reviewer}`,
    `Pattern Designer: ${appUsers.find((user) => user.id === attendees.designer)?.name ?? ''}`,
    `Scan Team: ${appUsers.find((user) => user.id === attendees.scan)?.name ?? ''}`,
    `Coordinator: ${appUsers.find((user) => user.id === attendees.coordinator)?.name ?? ''}`,
    `Manual Design: ${appUsers.find((user) => user.id === attendees.manual)?.name ?? ''}`,
  ];
  const activeUsers = appUsers.filter((user) => user.status === 'ACTIVE');
  const fitting = latestFitting(zone.id, visits);
  const fittingTime = Date.parse(
    fitting?.performedAt ?? `${fitting?.date}T${fitting?.time}`,
  );
  const qualityReady = hasCurrentFitmentQuality(
    zone.id,
    designs,
    visits,
    fitmentQualities,
  );
  const meetingReady = Boolean(
    meetingAt &&
    Number.isFinite(Date.parse(meetingAt)) &&
    Date.parse(meetingAt) <= Date.now() &&
    Object.values(attendees).every((id) =>
      activeUsers.some((user) => user.id === id),
    ) &&
    Date.parse(meetingAt) >= Math.floor(fittingTime / 60000) * 60000,
  );
  const [rejectionType, setRejectionType] = useState<'DOCUMENT' | 'PATTERN'>(
    'DOCUMENT',
  );
  const [affectedDesignIds, setAffectedDesignIds] = useState<readonly string[]>(
    [],
  );
  const [beforeTest, setBeforeTest] = useState<{
    meetingAt: string;
    attendees: typeof attendees;
    reviewer: string;
    blueprint: string;
    note: string;
    checked: boolean;
    affectedDesignIds: readonly string[];
  }>();
  const canRequestChanges =
    ['Fitting', 'Approved'].includes(zone.currentStage) &&
    meetingReady &&
    note.trim() &&
    (rejectionType !== 'PATTERN' || affectedDesignIds.length > 0) &&
    appUsers.some((user) => user.id === reviewer && user.status === 'ACTIVE');
  const blockers = [
    ...sizeReviewBlockers(zone, designs, visits),
    ...(!qualityReady
      ? ['Check quality for each part, then record an overall product PASS.']
      : []),
  ];
  const reviewed = qualityReady && isSizeReviewCurrent(zone, designs, visits);
  const shape = shapes.find((item) => item.id === zone.productShapeId);
  const candidates = shapes.filter(
    (item) =>
      item.productTypeId === zone.productTypeId &&
      (item.status === 'IN_DEVELOPMENT' ||
        (reviewed && item.status === 'ACTIVE')) &&
      !projects.some((project) =>
        project.zoneProjects.some(
          (other) => other.id !== zone.id && other.productShapeId === item.id,
        ),
      ) &&
      `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  const parts = designs.filter(
    (design) =>
      design.vehicleProjectId === zone.id && design.status === 'ACTIVE',
  );
  const reviewAllowed =
    !blockers.length &&
    meetingReady &&
    blueprint.trim() &&
    checked &&
    appUsers.some((user) => user.id === reviewer && user.status === 'ACTIVE');
  const linkAllowed =
    (!shape || replacing) &&
    zone.status !== 'CANCELLED' &&
    zone.status !== 'MERGED';

  function toggleTestInput(enabled: boolean): void {
    if (!enabled && beforeTest) {
      setMeetingAt(beforeTest.meetingAt);
      setAttendees(beforeTest.attendees);
      setReviewer(beforeTest.reviewer);
      setBlueprint(beforeTest.blueprint);
      setNote(beforeTest.note);
      setChecked(beforeTest.checked);
      setAffectedDesignIds(beforeTest.affectedDesignIds);
      setBeforeTest(undefined);
      return;
    }
    if (!enabled || !activeUsers.length) return;
    setBeforeTest({
      meetingAt,
      attendees,
      reviewer,
      blueprint,
      note,
      checked,
      affectedDesignIds,
    });
    const handoffTime = Date.parse(zone.productionHandoff?.completedAt ?? '');
    setMeetingAt(
      format(
        new Date(
          Math.max(Date.now(), Number.isFinite(handoffTime) ? handoffTime : 0),
        ),
        "yyyy-MM-dd'T'HH:mm",
      ),
    );
    setAttendees({
      designer: activeUsers.some((user) => user.id === attendees.designer)
        ? attendees.designer
        : (activeUsers[1] ?? activeUsers[0]).id,
      scan: activeUsers.some((user) => user.id === attendees.scan)
        ? attendees.scan
        : (activeUsers[2] ?? activeUsers[0]).id,
      coordinator: activeUsers.some((user) => user.id === attendees.coordinator)
        ? attendees.coordinator
        : (activeUsers[3] ?? activeUsers[0]).id,
      manual: activeUsers.some((user) => user.id === attendees.manual)
        ? attendees.manual
        : (activeUsers[4] ?? activeUsers[0]).id,
    });
    setReviewer(
      activeUsers.some((user) => user.id === reviewer)
        ? reviewer
        : activeUsers[0].id,
    );
    setBlueprint(blueprint.trim() || `[TEST] ${zone.id} Final blueprint`);
    setNote(note.trim() || '[TEST] Shape review and approval flow test');
    setChecked(true);
    if (rejectionType === 'PATTERN' && !affectedDesignIds.length) {
      setAffectedDesignIds(parts.map((part) => part.id));
    }
  }
  return (
    <div className="shape-management project-shape-panel">
      <div className="shape-info">
        <strong>Shape · {zone.code}</strong>
        <p>
          Create development Shape → Verify fitting and quality → Review and
          confirm → Handoff
        </p>
        <p>
          You can create a Shape during development. One Shape links to one
          development project; fitments across sales vehicles are managed
          separately.
        </p>
        <Link to="/product-shapes">Manage all Shapes →</Link>
        {zone.productionHandoff && (
          <p>
            Handoff: {zone.productionHandoff.completedAt.slice(0, 10)} ·{' '}
            {zone.productionHandoff.reference}
          </p>
        )}
      </div>
      <section className="shape-section">
        <h3>1. Review fitting results and final materials</h3>
        {blockers.length ? (
          <ul className="shape-errors">
            {blockers.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : (
          <p>
            Fitting PASS and part / pattern revisions are ready. Verify that the
            blueprint matches the final composition.
          </p>
        )}
        <div className="shape-actions">
          <Button variant="outline" onClick={() => onOpenTab('visits')}>
            Fitting visits
          </Button>
          <Button variant="outline" onClick={() => onOpenTab('designs')}>
            Final parts / Pattern {parts.length} items
          </Button>
          <Button variant="outline" onClick={() => onOpenTab('files')}>
            Review materials
          </Button>
        </div>
        {parts.length > 0 && (
          <ul>
            {parts.map((part) => (
              <li key={part.id}>
                {part.name} · Quantity {part.quantity} · Rev{' '}
                {Math.max(
                  0,
                  ...part.revisions.map((revision) => revision.revisionNumber),
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <FitmentQualityPanel zone={zone} designs={designs} visits={visits} />
      <section className="shape-section shape-review-section">
        <h3>Shape review meeting and verbal approval</h3>
        <p>
          Attendees: PM / Director, Pattern Designer, Scan Team, Coordinator,
          Manual Designer
        </p>
        {reviewed ? (
          <div className="shape-success">
            <strong>
              The current parts composition and fitting results have been
              reviewed.
            </strong>
            <p>
              {appUsers.find((user) => user.id === zone.sizeReview?.reviewedBy)
                ?.name ?? zone.sizeReview?.reviewedBy}{' '}
              · {zone.sizeReview?.reviewedAt.slice(0, 10)}
            </p>
            <p>Blueprint: {zone.sizeReview?.blueprintReference}</p>
            <p>
              Meeting: {zone.sizeReview?.meetingAt} · Attendees:{' '}
              {zone.sizeReview?.participants?.join(', ')} · Verbal approval
            </p>
            {zone.sizeReview?.note && <p>{zone.sizeReview.note}</p>}
          </div>
        ) : (
          <>
            {zone.sizeReview?.outcome === 'REJECTED' && (
              <div role="status" className="shape-errors">
                <strong>Changes requested: {zone.sizeReview.note}</strong>
                <p>
                  Update the documents and review again. If the pattern needs
                  changes, create a new revision and repeat sampling and
                  fitting.
                </p>
              </div>
            )}
            {zone.sizeReview && zone.sizeReview.outcome !== 'REJECTED' && (
              <p role="status" className="shape-errors">
                Part revisions, composition, or fitting records changed. Review
                the current materials again. Existing Shape links are preserved.
              </p>
            )}
            <div className="shape-review-fields">
              <label>
                Meeting date and time *
                <Input
                  type="datetime-local"
                  value={meetingAt}
                  onChange={(event) => setMeetingAt(event.target.value)}
                />
              </label>
              <label>
                Review lead (PM / Director) *
                <UserPicker
                  users={activeUsers}
                  value={appUsers.find((user) => user.id === reviewer)}
                  label="Review lead (PM / Director)"
                  placeholder="Search and select review lead"
                  onChange={(userId) => setReviewer(userId ?? '')}
                />
              </label>
              {(
                [
                  ['designer', 'Pattern Designer'],
                  ['scan', 'Scan Team'],
                  ['coordinator', 'Coordinator'],
                  ['manual', 'Manual Design'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label} Attendees *
                  <UserPicker
                    users={activeUsers}
                    value={appUsers.find((user) => user.id === attendees[key])}
                    label={`${label} Attendees`}
                    onChange={(userId) =>
                      setAttendees((current) => ({
                        ...current,
                        [key]: userId ?? '',
                      }))
                    }
                    placeholder="Search and select attendees"
                  />
                </label>
              ))}
              <label className="full-width">
                Final blueprint reference *
                <Input
                  value={blueprint}
                  onChange={(event) => setBlueprint(event.target.value)}
                  placeholder="Final blueprint file name, NAS path, or document link"
                />
              </label>
              <label className="full-width">
                Review notes
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Final composition, fitment, and rationale for Shape reuse"
                />
              </label>
            </div>
            <div className="shape-review-approval">
              <label className="shape-check shrink-0">
                <Checkbox
                  checked={beforeTest !== undefined}
                  disabled={!activeUsers.length}
                  onCheckedChange={(value) => toggleTestInput(value === true)}
                />
                Fill test values
              </label>
              <label className="shape-check">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => setChecked(value === true)}
                />
                Record that the lead reviewed the fitting results, final parts
                list, and blueprint in the meeting and verbally approved Shape
                issuance or reuse.
              </label>
              <Button
                variant="primary"
                disabled={!reviewAllowed}
                onClick={() => {
                  if (!reviewAllowed) return;
                  onReview({
                    meetingAt,
                    participants,
                    approvalMethod: 'VERBAL',
                    outcome: 'APPROVED',
                    reviewedBy: reviewer,
                    reviewedAt: new Date().toISOString(),
                    blueprintReference: blueprint.trim(),
                    note: note.trim(),
                    evidenceKey: sizeReviewEvidence(zone.id, designs, visits),
                  });
                }}
              >
                Record review approval
              </Button>
            </div>
            <div className="shape-review-rejection">
              <label className="shape-review-rejection-type">
                Record rejection
                <select
                  value={rejectionType}
                  onChange={(event) =>
                    setRejectionType(
                      event.target.value as 'DOCUMENT' | 'PATTERN',
                    )
                  }
                >
                  <option value="DOCUMENT">
                    Revise documents and review again
                  </option>
                  <option value="PATTERN">
                    Pattern rework · Return to new sample request
                  </option>
                </select>
              </label>
              {rejectionType === 'PATTERN' && (
                <div className="shape-review-rejection-parts">
                  <p>
                    Select parts to revise. These parts need a new revision and
                    new samples; the entire project must repeat fitting and
                    handoff.
                  </p>
                  {parts.map((part) => (
                    <label className="shape-check" key={part.id}>
                      <Checkbox
                        checked={affectedDesignIds.includes(part.id)}
                        onCheckedChange={(value) =>
                          setAffectedDesignIds((current) =>
                            value === true
                              ? [...current, part.id]
                              : current.filter((id) => id !== part.id),
                          )
                        }
                      />
                      {part.name}
                    </label>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                disabled={!canRequestChanges}
                onClick={() => {
                  if (!canRequestChanges) return;
                  onReview({
                    meetingAt,
                    participants,
                    rejectionType,
                    affectedDesignIds:
                      rejectionType === 'PATTERN' ? affectedDesignIds : [],
                    outcome: 'REJECTED',
                    reviewedBy: reviewer,
                    reviewedAt: new Date().toISOString(),
                    blueprintReference: blueprint.trim(),
                    note: note.trim(),
                    evidenceKey: sizeReviewEvidence(zone.id, designs, visits),
                  });
                  setChecked(false);
                }}
              >
                Record rejection (reason required)
              </Button>
            </div>
            <p className="muted-text">
              A post-fitting meeting date, attendees, required materials, review
              lead, and confirmation are all required. This screen records
              real-world approval results but does not verify account-level
              approval permissions.
            </p>
          </>
        )}
      </section>
      <section className="shape-section">
        <h3>Issue / Link final Shape</h3>
        {shape ? (
          <div className="shape-success">
            <strong>
              {shape.name} · {SHAPE_STATUSES[shape.status]}
            </strong>
            <p>{dimensionsLabel(shape.dimensions)}</p>
            {shape.status === 'IN_DEVELOPMENT' && (
              <Button
                disabled={!reviewed}
                onClick={() => setEditor('ACTIVATE')}
              >
                Confirm Shape after quality and review approval
              </Button>
            )}
            <Link to={`/product-shapes?shape=${encodeURIComponent(shape.id)}`}>
              Manage Shape details and linked projects →
            </Link>
            {reviewed && (
              <div className="shape-actions">
                <Button
                  variant="outline"
                  onClick={() => setReplacing(!replacing)}
                >
                  {replacing ? 'Discard changes' : 'Change linked Shape'}
                </Button>
              </div>
            )}
            <p>
              After issuance, add parts composition and a blueprint in Issued
              Shapes.
            </p>
          </div>
        ) : (
          <p>No final Shape linked.</p>
        )}
        {!reviewed && (
          <p className="shape-errors">
            Development Shapes can be created and linked. ACTIVE confirmation
            requires quality PASS and review approval.
          </p>
        )}
        {(!shape || replacing) && (
          <>
            <div className="shape-actions">
              <Button
                variant="primary"
                disabled={!linkAllowed}
                onClick={() => setEditor('NEW')}
              >
                Create / Link development Shape
              </Button>
            </div>
            <p>
              Only Shapes not already linked to another development project are
              selectable.
            </p>
            <div className="shape-filters">
              <Input
                aria-label="Search existing Shapes"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected('');
                }}
                placeholder="Search existing Shapes"
              />
              <select
                aria-label="Existing Shape to link"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">
                  Select an unlinked Shape of the same product type
                </option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={!linkAllowed || !selected}
                onClick={() => {
                  if (
                    linkAllowed &&
                    candidates.some((item) => item.id === selected)
                  ) {
                    onLink(selected);
                    setReplacing(false);
                  }
                }}
              >
                Link existing Shape
              </Button>
            </div>
            {!candidates.length && <p>No eligible confirmed Shapes.</p>}
          </>
        )}
      </section>
      {(zone.shapeReviewHistory?.length ?? 0) > 0 && (
        <details className="shape-section">
          <summary>
            Review history {zone.shapeReviewHistory?.length} items
          </summary>
          {zone.shapeReviewHistory?.map((review, index) => (
            <p key={`${review.reviewedAt}-${index}`}>
              {review.reviewedAt} · {review.reviewedBy} ·{' '}
              {review.outcome === 'APPROVED'
                ? 'Verbal approval'
                : review.rejectionType === 'PATTERN'
                  ? 'Pattern rejected → New sample request'
                  : 'Document corrections'}{' '}
              · {review.note} · Blueprint: {review.blueprintReference}
            </p>
          ))}
        </details>
      )}
      {editor && (
        <ShapeEditor
          shapes={shapes}
          productTypeId={zone.productTypeId}
          shape={editor === 'ACTIVATE' ? shape : undefined}
          issuanceApproved={editor === 'ACTIVATE' && reviewed}
          usageCount={editor === 'ACTIVATE' ? 1 : 0}
          onClose={() => setEditor(false)}
          onSave={(item) => {
            if (editor === 'ACTIVATE' ? !reviewed : !linkAllowed) return;
            setVehicleProductShapes((current) =>
              editor === 'ACTIVATE'
                ? current.map((row) => (row.id === item.id ? item : row))
                : [...current, item],
            );
            onLink(item.id);
            setEditor(false);
            setReplacing(false);
          }}
        />
      )}
    </div>
  );
}

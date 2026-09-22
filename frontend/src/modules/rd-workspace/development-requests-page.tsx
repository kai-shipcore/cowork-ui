import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ComplaintImportGrid } from './complaint-import-grid';
import { DevelopmentRequestGrid } from './development-request-grid';
import { DevelopmentRequestTabs } from './development-request-tabs';
import {
  EMPTY_INTAKES,
  INTAKE_KEY,
  INTAKE_SOURCES,
  INTAKE_STATUSES,
  intakeSchema,
  intakesSchema,
  parseIntakeStatusFilter,
  reviewIntake,
  type DevelopmentIntake,
} from './intake-model';
import { useRdRecords } from './use-rd-records';
import './rd-workspace.css';
import { formText } from './form-text';

/** Demand intake is separate from operational team-to-team requests. */
export function DevelopmentRequestsPage(): ReactElement {
  const { configurations, projects, complaints, uniqueVehicles } =
    useWorkbenchStore();
  const { actor } = useOperations();
  const { records, save, error, saving } = useRdRecords(
    INTAKE_KEY,
    intakesSchema,
    EMPTY_INTAKES,
  );
  const [params, setParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const selected = records.find((entry) => entry.id === params.get('request'));
  const query = params.get('q') ?? '';
  const filter = parseIntakeStatusFilter(params.get('status'));
  const visible = records.filter(
    (entry) =>
      (filter === 'All' || entry.status === filter) &&
      `${entry.vehicle} ${entry.source} ${entry.sourceReference}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function changeFilter(key: string, value: string): void {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set(key, value);
      return next;
    });
  }
  const complaintRows = complaints
    .filter((complaint) => complaint.status !== 'RESOLVED')
    .flatMap((complaint): DevelopmentIntake[] => {
      const vehicle = uniqueVehicles.find(
        (entry) => entry.fNumber === complaint.fNumber,
      );
      const parsed = intakeSchema.safeParse({
        id: 'intake-' + complaint.id,
        vehicle: complaint.vehicle,
        configurationId: vehicle?.vehicleResearchId ?? '',
        product: complaint.product,
        source: 'Complaint',
        sourceReference: complaint.id,
        notifyCount: 0,
        complaintCount: 1,
        b2bUnits: 0,
        releaseDate: '',
        evidence: complaint.issue,
        priority: 'NORMAL',
        status: 'Awaiting review',
        reviews: [],
        createdAt: '',
      });
      return parsed.success ? [parsed.data] : [];
    });
  async function importComplaints(): Promise<void> {
    const createdAt = new Date().toISOString();
    const ok = await save((current) => [
      ...current,
      ...complaintRows
        .filter(
          (entry) => !current.some((existing) => existing.id === entry.id),
        )
        .map((entry) => ({ ...entry, createdAt })),
    ]);
    if (ok)
      setMessage(
        'Imported eligible open complaints. Duplicates and records missing a vehicle or issue were skipped.',
      );
  }
  return (
    <section className="rd-workspace">
      <div className="rd-toolbar">
        <div className="workbench-heading">
          <h1>Development Requests · Demand Review</h1>
          <p>
            Notify Me · Complaints · B2B · Vehicle Launches → Development
            Decision → Project
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
      <p role="status">{message}</p>
      <DevelopmentRequestTabs
        complaints={
          <ComplaintImportGrid
            rows={complaintRows}
            records={records}
            saving={saving}
            onImport={() => {
              void importComplaints();
            }}
          />
        }
        requests={
          <>
            <DevelopmentRequestGrid
              rows={visible}
              projects={projects}
              configurations={configurations}
              query={query}
              status={filter}
              onFilter={changeFilter}
              actions={
                <Button
                  aria-expanded={showForm}
                  aria-controls="development-request-form"
                  onClick={() => {
                    setShowForm(!showForm);
                  }}
                >
                  <Plus />
                  {showForm
                    ? 'Close registration form'
                    : 'New development request'}
                </Button>
              }
            />
            {showForm && (
              <form
                id="development-request-form"
                className="rd-panel m-3 sm:m-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  const result = intakeSchema.safeParse({
                    id: 'DEV-' + crypto.randomUUID(),
                    vehicle: data.get('vehicle'),
                    configurationId: data.get('configuration'),
                    product: data.get('product'),
                    source: data.get('source'),
                    sourceReference: data.get('reference'),
                    notifyCount: Number(data.get('notify')),
                    complaintCount: Number(data.get('complaints')),
                    b2bUnits: Number(data.get('b2b')),
                    releaseDate: data.get('release'),
                    evidence: data.get('evidence'),
                    priority: data.get('priority'),
                    status: 'Awaiting review',
                    reviews: [],
                    createdAt: new Date().toISOString(),
                  });
                  if (!result.success) {
                    setMessage('Check the entered values and demand evidence.');
                    return;
                  }
                  const configuration = configurations.find(
                    (entry) => entry.id === result.data.configurationId,
                  );
                  const draft = {
                    ...result.data,
                    vehicle: configuration?.vehicle ?? result.data.vehicle,
                  };
                  void save((current) => [...current, draft]).then((ok) => {
                    if (ok) {
                      setShowForm(false);
                      setMessage('Development request created.');
                    }
                  });
                }}
              >
                <h2>New development request</h2>
                <div className="rd-fields">
                  <label>
                    Vehicle name
                    <input
                      name="vehicle"
                      required
                      maxLength={160}
                      placeholder="2026 Hyundai Santa Fe"
                    />
                  </label>
                  <label>
                    Link existing research configuration
                    <select name="configuration">
                      <option value="">Not linked · Link after research</option>
                      {configurations.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.vehicle} · {entry.id} ·{' '}
                          {entry.options.map((option) => option[1]).join(' / ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Product
                    <select name="product">
                      <option>Seat Cover</option>
                      <option>Floor Mat</option>
                      <option>Car Cover</option>
                    </select>
                  </label>
                  <label>
                    Primary source
                    <select name="source">
                      {INTAKE_SOURCES.map((source) => (
                        <option key={source}>{source}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Source ID / Document reference
                    <input name="reference" maxLength={300} />
                  </label>
                  <label>
                    Notify Me count
                    <input
                      type="number"
                      name="notify"
                      min={0}
                      step={1}
                      defaultValue={0}
                      required
                    />
                  </label>
                  <label>
                    Complaint count
                    <input
                      type="number"
                      name="complaints"
                      min={0}
                      step={1}
                      defaultValue={0}
                      required
                    />
                  </label>
                  <label>
                    B2B committed units
                    <input
                      type="number"
                      name="b2b"
                      min={0}
                      step={1}
                      defaultValue={0}
                      required
                    />
                  </label>
                  <label>
                    Expected vehicle launch date
                    <input type="date" name="release" />
                  </label>
                  <label>
                    Initial priority
                    <select name="priority" defaultValue="NORMAL">
                      <option>LOW</option>
                      <option>NORMAL</option>
                      <option>HIGH</option>
                      <option>URGENT</option>
                    </select>
                  </label>
                </div>
                <label>
                  Demand evidence / Development rationale
                  <textarea
                    name="evidence"
                    required
                    maxLength={2000}
                    rows={3}
                  />
                </label>
                <Button type="submit" disabled={saving}>
                  Create
                </Button>
              </form>
            )}
            {selected && (
              <form
                key={selected.id + String(selected.reviews.length)}
                className="rd-panel m-3 sm:m-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const reason = formText(data, 'reason').trim();
                  const status = INTAKE_STATUSES.find(
                    (item) => item === data.get('status'),
                  );
                  const priority = intakeSchema.shape.priority.safeParse(
                    data.get('priority'),
                  );
                  const configId = formText(data, 'configuration');
                  if (!status || !priority.success || !reason) return;
                  void save((current) =>
                    current.map((entry) =>
                      entry.id === selected.id
                        ? reviewIntake(
                            { ...entry, configurationId: configId },
                            {
                              at: new Date().toISOString(),
                              status,
                              priority: priority.data,
                              reason,
                              actor: actor.name,
                            },
                          )
                        : entry,
                    ),
                  ).then((ok) => {
                    if (ok) setMessage('Review decision and reason recorded.');
                  });
                }}
              >
                <h2>{selected.vehicle} · Review</h2>
                <p className="whitespace-pre-wrap">{selected.evidence}</p>
                <p>Source: {selected.sourceReference || 'Not entered'}</p>
                <div className="rd-fields">
                  <label>
                    Research configuration to link
                    <select
                      name="configuration"
                      defaultValue={selected.configurationId}
                    >
                      <option value="">Not linked</option>
                      {configurations
                        .filter((entry) => entry.vehicle === selected.vehicle)
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.id} ·{' '}
                            {entry.options
                              .map((option) => option[1])
                              .join(' / ')}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Review decision
                    <select name="status" defaultValue={selected.status}>
                      {INTAKE_STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select name="priority" defaultValue={selected.priority}>
                      <option>LOW</option>
                      <option>NORMAL</option>
                      <option>HIGH</option>
                      <option>URGENT</option>
                    </select>
                  </label>
                </div>
                <label>
                  Review / Change reason
                  <textarea required name="reason" maxLength={1000} rows={2} />
                </label>
                <Button type="submit" disabled={saving}>
                  Save review decision
                </Button>
                <div>
                  {selected.reviews.map((review, index) => (
                    <p key={review.at + String(index)}>
                      {review.at.slice(0, 16).replace('T', ' ')} ·{' '}
                      {review.actor} · {review.status} / {review.priority} —{' '}
                      {review.reason}
                    </p>
                  ))}
                </div>
              </form>
            )}
          </>
        }
      />
    </section>
  );
}

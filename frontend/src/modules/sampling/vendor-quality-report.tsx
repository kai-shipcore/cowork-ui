import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { today } from '@/modules/operations/operations-model';
import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  vendorFailureCases,
  vendorQualityReport,
} from './vendor-quality-model';
import '@/modules/rd-workspace/rd-workspace.css';
import { formText } from '@/modules/rd-workspace/form-text';

const actionsSchema = z.array(
  z.object({
    id: z.string(),
    caseId: z.string(),
    status: z.preprocess(
      (value) =>
        value === '조치 중'
          ? 'Action in progress'
          : value === '종결'
            ? 'Resolved'
            : value,
      z.enum(['Action in progress', 'Resolved']),
    ),
    note: z.string().trim().min(1).max(2000),
    actor: z.string(),
    at: z.string(),
  }),
);
const EMPTY_ACTIONS: z.infer<typeof actionsSchema> = [];

/** Derived quality issues retain their sample evidence and append-only follow-up notes. */
export function VendorQualityReport(): ReactElement {
  const { sampleRequests, sampleRequestItems, sampleShipments, projects } =
    useWorkbenchStore();
  const { actor } = useOperations();
  const [factory, setFactory] = useState('All');
  const [caseId, setCaseId] = useState('');
  const [message, setMessage] = useState('');
  const { records, save, error, saving } = useRdRecords(
    'coverland-vendor-issue-actions-v1',
    actionsSchema,
    EMPTY_ACTIONS,
  );
  const reports = vendorQualityReport(
    sampleRequests,
    sampleRequestItems,
    sampleShipments,
    today(),
  );
  const cases = vendorFailureCases(sampleRequests, sampleRequestItems).filter(
    (entry) => factory === 'All' || entry.factory === factory,
  );
  const selected = cases.find((entry) => entry.id === caseId);
  return (
    <section className="rd-workspace">
      <div className="rd-panel">
        <div className="rd-toolbar">
          <h2>Factory Quality & Delivery Report</h2>
          <label>
            Factory
            <select
              value={factory}
              onChange={(event) => {
                setFactory(event.target.value);
                setCaseId('');
              }}
            >
              <option>All</option>
              {reports.map((entry) => (
                <option key={entry.factory}>{entry.factory}</option>
              ))}
            </select>
          </label>
        </div>
        <p>
          All stored history · Quality denominator: inspected part lines.
          Delivery denominator: shipments with both expected and actual receipt
          dates. Separate from design fitment failure rates.
        </p>
        <div className="rd-table">
          <table>
            <thead>
              <tr>
                <th>Factory</th>
                <th>Requested parts</th>
                <th>Inspected</th>
                <th>Manufacturing / Implementation issues</th>
                <th>Issue rate</th>
                <th>On-time receipts</th>
                <th>Overdue receipts</th>
              </tr>
            </thead>
            <tbody>
              {reports
                .filter(
                  (entry) => factory === 'All' || entry.factory === factory,
                )
                .map((entry) => (
                  <tr key={entry.factory}>
                    <td>{entry.factory}</td>
                    <td>{entry.requested}</td>
                    <td>{entry.inspected}</td>
                    <td>{entry.failed}</td>
                    <td>
                      {entry.inspected
                        ? String(
                            Math.round((entry.failed / entry.inspected) * 100),
                          ) + '%'
                        : '—'}
                    </td>
                    <td>
                      {entry.measured
                        ? `${String(Math.round((entry.onTime / entry.measured) * 100))}% (${String(entry.onTime)}/${String(entry.measured)})`
                        : 'No comparable receipt dates'}
                    </td>
                    <td>{entry.overdue} items</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!reports.length && (
          <p className="rd-empty">No factory request or shipment records.</p>
        )}
      </div>
      <div className="rd-panel">
        <h2>Sample-linked quality issues · {cases.length} items</h2>
        <p>
          Groups drawing mismatches and partial or missing implementation from
          inspections. Issues affecting the same part in two or more rounds are
          marked Recurring. A new failed round after closure requires another
          review.
        </p>
        <div className="rd-table">
          <table>
            <thead>
              <tr>
                <th>Factory / Part</th>
                <th>Project</th>
                <th>Failed rounds</th>
                <th>Action status</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((entry) => {
                const latest = records
                  .filter((record) => record.caseId === entry.id)
                  .slice(-1)
                  .pop();
                const project = projects.find(
                  (item) => item.id === entry.projectId,
                );
                return (
                  <tr key={entry.id}>
                    <td>
                      {entry.factory}
                      <br />
                      <small>{entry.designId}</small>
                    </td>
                    <td>{project?.vehicle ?? entry.projectId}</td>
                    <td>
                      {entry.rounds} times
                      {entry.rounds > 1 && (
                        <strong className="rd-error"> · Recurring</strong>
                      )}
                    </td>
                    <td>{latest?.status ?? 'No action'}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCaseId(entry.id);
                        }}
                      >
                        Evidence / Action
                      </Button>{' '}
                      <Link
                        to={
                          '/vehicle-projects?project=' +
                          entry.projectId +
                          '&tab=samples'
                        }
                      >
                        Project samples
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!cases.length && (
          <p className="rd-empty">
            No manufacturing or implementation issues found in inspections.
            Uninspected items are excluded.
          </p>
        )}
      </div>
      {selected && (
        <form
          key={selected.id}
          className="rd-panel"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const status =
              data.get('status') === 'Resolved'
                ? ('Resolved' as const)
                : ('Action in progress' as const);
            const note = formText(data, 'note').trim();
            if (!note) return;
            void save((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                caseId: selected.id,
                status,
                note,
                actor: actor.name,
                at: new Date().toISOString(),
              },
            ]).then((ok) => {
              if (ok) setMessage('Quality issue action recorded.');
            });
          }}
        >
          <h2>
            {selected.factory} · {selected.designId}
          </h2>
          {selected.items.map((item) => (
            <p key={item.id}>
              Round {item.sampleRound} · {item.id} ·{' '}
              {item.revisionReflected ?? 'Implementation not assessed'} ·
              Drawing{' '}
              {item.drawingMatch === false
                ? 'Mismatch'
                : 'No mismatch recorded'}
              <br />
              {item.inspectionNote ??
                item.verificationNote ??
                'No additional notes'}
            </p>
          ))}
          <label>
            Action status
            <select name="status">
              <option>Action in progress</option>
              <option>Resolved</option>
            </select>
          </label>
          <label>
            Cause / Factory response / Reverification evidence
            <textarea name="note" rows={3} required maxLength={2000} />
          </label>
          <Button type="submit" disabled={saving}>
            Save action record
          </Button>
          <p>
            Closing an issue does not replace sample acceptance or project
            approval.
          </p>
          {records
            .filter((record) => record.caseId === selected.id)
            .map((record) => (
              <p key={record.id}>
                {record.at.slice(0, 16)} · {record.actor} · {record.status} —{' '}
                {record.note}
              </p>
            ))}
        </form>
      )}
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
      <p role="status">{message}</p>
    </section>
  );
}

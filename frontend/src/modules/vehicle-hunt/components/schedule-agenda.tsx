import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { userName } from '@/shared/domain/app-user';
import type {
  AppUser,
  VehicleProjectGroup,
  Visit,
} from '@/shared/types/workbench';
import { today } from '@/modules/operations/operations-model';
import { scheduleDays, shiftDate } from '../schedule-model';

interface ScheduleAgendaProps {
  mode: 'week' | 'day';
  visits: readonly Visit[];
  users: readonly AppUser[];
  scanQueue: readonly VehicleProjectGroup[];
  fittingQueue: readonly VehicleProjectGroup[];
  onVisit: (id: string) => void;
  onBook: (projectId: string, kind: Visit['kind'], date: string) => void;
}

/** Both queues use the existing booking dialog and its zone eligibility validation. */
export function ScheduleAgenda({
  mode,
  visits,
  users,
  scanQueue,
  fittingQueue,
  onVisit,
  onBook,
}: ScheduleAgendaProps): ReactElement {
  const [date, setDate] = useState(today());
  const [queueId, setQueueId] = useState('');
  const queues = [
    ...scanQueue.map((project) => ({
      id: 'SCAN:' + project.id,
      project,
      kind: 'SCAN' as const,
    })),
    ...fittingQueue.map((project) => ({
      id: 'FITTING:' + project.id,
      project,
      kind: 'FITTING' as const,
    })),
  ];
  const selected = queues.find((entry) => entry.id === queueId);
  const days = scheduleDays(date, mode);
  return (
    <div className="rd-workspace">
      <div className="rd-toolbar">
        <Button
          variant="outline"
          onClick={() => {
            setDate(shiftDate(date, mode === 'week' ? -7 : -1));
          }}
        >
          ← Previous
        </Button>
        <label>
          Reference date
          <input
            type="date"
            value={date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value);
            }}
          />
        </label>
        <Button
          variant="outline"
          onClick={() => {
            setDate(shiftDate(date, mode === 'week' ? 7 : 1));
          }}
        >
          Next →
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDate(today());
          }}
        >
          Today
        </Button>
        <p>Los Angeles · Search, dealer, and assignee filters above apply</p>
      </div>
      <div className="rd-panel">
        <h2>Pending work → Schedule visit</h2>
        <p>
          Scan {scanQueue.length} items · Fitting {fittingQueue.length} items.
          Select work, then choose Schedule on the desired date. Confirm zones
          and assignee in the booking dialog.
        </p>
        <label>
          Pending work to schedule
          <select
            value={queueId}
            onChange={(event) => {
              setQueueId(event.target.value);
            }}
          >
            <option value="">Select work</option>
            {queues.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.kind === 'SCAN' ? 'Scan' : 'Fitting'} ·{' '}
                {entry.project.vehicle} · {entry.project.id}
              </option>
            ))}
          </select>
        </label>
        {!queues.length && (
          <p>No pending work is currently eligible for scheduling.</p>
        )}
      </div>
      <div className="rd-agenda" data-mode={mode}>
        {days.map((day) => {
          const rows = visits
            .filter((visit) => visit.date === day)
            .sort((a, b) => a.time.localeCompare(b.time));
          return (
            <section className="rd-day" key={day}>
              <div className="rd-toolbar">
                <strong className="text-sm">
                  {day.slice(5)} ·{' '}
                  {
                    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
                      new Date(day + 'T12:00:00Z').getUTCDay()
                    ]
                  }
                </strong>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selected}
                  onClick={() => {
                    if (selected)
                      onBook(selected.project.id, selected.kind, day);
                  }}
                >
                  Schedule
                </Button>
              </div>
              {rows.map((visit) => (
                <button
                  type="button"
                  className="rd-board-card"
                  key={visit.id}
                  onClick={() => {
                    onVisit(visit.id);
                  }}
                >
                  <strong>
                    {visit.time} · {visit.kind === 'SCAN' ? 'Scan' : 'Fitting'}
                  </strong>
                  <span>{visit.vehicle}</span>
                  <span>{visit.dealer}</span>
                  <small>
                    {visit.staffIds?.length
                      ? visit.staffIds
                          .map((id) => userName(users, id))
                          .join(', ')
                      : 'Unassigned'}
                  </small>
                  <small>{visit.status}</small>
                </button>
              ))}
              {!rows.length && <p>No visits scheduled</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

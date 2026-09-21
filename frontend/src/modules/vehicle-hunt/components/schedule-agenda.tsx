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
          ← 이전
        </Button>
        <label>
          기준 날짜
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
          다음 →
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDate(today());
          }}
        >
          오늘
        </Button>
        <p>Los Angeles · 위 검색·딜러·담당자 필터 적용</p>
      </div>
      <div className="rd-panel">
        <h2>대기 업무 → 일정 예약</h2>
        <p>
          스캔 {scanQueue.length}건 · 피팅 {fittingQueue.length}건. 업무를
          선택하고 원하는 날짜의 ‘예약’을 누르세요. Zone과 담당자는 예약창에서
          확인합니다.
        </p>
        <label>
          예약할 대기 업무
          <select
            value={queueId}
            onChange={(event) => {
              setQueueId(event.target.value);
            }}
          >
            <option value="">업무 선택</option>
            {queues.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.kind === 'SCAN' ? '스캔' : '피팅'} ·{' '}
                {entry.project.vehicle} · {entry.project.id}
              </option>
            ))}
          </select>
        </label>
        {!queues.length && <p>현재 예약 가능한 대기 업무가 없습니다.</p>}
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
                    ['일', '월', '화', '수', '목', '금', '토'][
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
                  예약
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
                    {visit.time} · {visit.kind === 'SCAN' ? '스캔' : '피팅'}
                  </strong>
                  <span>{visit.vehicle}</span>
                  <span>{visit.dealer}</span>
                  <small>
                    {visit.staffIds?.length
                      ? visit.staffIds
                          .map((id) => userName(users, id))
                          .join(', ')
                      : '담당자 미지정'}
                  </small>
                  <small>{visit.status}</small>
                </button>
              ))}
              {!rows.length && <p>등록된 일정 없음</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

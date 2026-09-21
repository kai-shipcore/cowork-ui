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
    status: z.enum(['조치 중', '종결']),
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
  const [factory, setFactory] = useState('전체');
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
    (entry) => factory === '전체' || entry.factory === factory,
  );
  const selected = cases.find((entry) => entry.id === caseId);
  return (
    <section className="rd-workspace">
      <div className="rd-panel">
        <div className="rd-toolbar">
          <h2>공장별 품질 · 납기 리포트</h2>
          <label>
            공장
            <select
              value={factory}
              onChange={(event) => {
                setFactory(event.target.value);
                setCaseId('');
              }}
            >
              <option>전체</option>
              {reports.map((entry) => (
                <option key={entry.factory}>{entry.factory}</option>
              ))}
            </select>
          </label>
        </div>
        <p>
          현재 저장된 전체 기간 · 품질 모수는 검수 완료 Part Line, 납기 모수는
          예정일과 실제 입고일이 모두 있는 Shipment입니다. 설계 피팅 불량률과
          구분합니다.
        </p>
        <div className="rd-table">
          <table>
            <thead>
              <tr>
                <th>공장</th>
                <th>요청 부품</th>
                <th>검수 완료</th>
                <th>제작·미반영 문제</th>
                <th>문제율</th>
                <th>정시 입고</th>
                <th>미입고 지연</th>
              </tr>
            </thead>
            <tbody>
              {reports
                .filter(
                  (entry) => factory === '전체' || entry.factory === factory,
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
                        : '비교할 입고일 없음'}
                    </td>
                    <td>{entry.overdue}건</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!reports.length && (
          <p className="rd-empty">공장 요청·운송 기록이 없습니다.</p>
        )}
      </div>
      <div className="rd-panel">
        <h2>샘플 연계 품질 이슈 · {cases.length}건</h2>
        <p>
          검수 기록의 도면 불일치·부분 반영·미반영을 자동으로 묶습니다. 같은
          부품에서 2개 이상의 라운드에 발생하면 ‘반복’으로 표시합니다. 종결 뒤
          새 실패 라운드가 생기면 다시 확인해야 합니다.
        </p>
        <div className="rd-table">
          <table>
            <thead>
              <tr>
                <th>공장 / 부품</th>
                <th>프로젝트</th>
                <th>실패 라운드</th>
                <th>조치 상태</th>
                <th>연결</th>
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
                      {entry.rounds}회
                      {entry.rounds > 1 && (
                        <strong className="rd-error"> · 반복</strong>
                      )}
                    </td>
                    <td>{latest?.status ?? '미조치'}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCaseId(entry.id);
                        }}
                      >
                        근거 · 조치
                      </Button>{' '}
                      <Link
                        to={
                          '/vehicle-projects?project=' +
                          entry.projectId +
                          '&tab=samples'
                        }
                      >
                        프로젝트 샘플
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
            검수에서 확인된 제작·미반영 문제가 없습니다. 미검수 항목은 이 결과에
            포함되지 않습니다.
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
              data.get('status') === '종결'
                ? ('종결' as const)
                : ('조치 중' as const);
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
              if (ok) setMessage('품질 이슈 조치를 기록했습니다.');
            });
          }}
        >
          <h2>
            {selected.factory} · {selected.designId}
          </h2>
          {selected.items.map((item) => (
            <p key={item.id}>
              Round {item.sampleRound} · {item.id} ·{' '}
              {item.revisionReflected ?? '반영 판단 없음'} · 도면{' '}
              {item.drawingMatch === false ? '불일치' : '불일치 기록 없음'}
              <br />
              {item.inspectionNote ?? item.verificationNote ?? '추가 메모 없음'}
            </p>
          ))}
          <label>
            조치 상태
            <select name="status">
              <option>조치 중</option>
              <option>종결</option>
            </select>
          </label>
          <label>
            원인·공장 회신·재검증 근거
            <textarea name="note" rows={3} required maxLength={2000} />
          </label>
          <Button type="submit" disabled={saving}>
            조치 기록 저장
          </Button>
          <p>이슈 종결은 샘플 합격이나 프로젝트 승인을 대신하지 않습니다.</p>
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

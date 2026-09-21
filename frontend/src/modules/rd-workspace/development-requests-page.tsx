import { useState, type ReactElement } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  EMPTY_INTAKES,
  INTAKE_KEY,
  INTAKE_SOURCES,
  INTAKE_STATUSES,
  intakeSchema,
  intakesSchema,
  linkedIntakeProjects,
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
  const filter = params.get('status') ?? '전체';
  const visible = records.filter(
    (entry) =>
      (filter === '전체' || entry.status === filter) &&
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
  async function importComplaints(): Promise<void> {
    const additions = complaints
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
          source: '컴플레인',
          sourceReference: complaint.id,
          notifyCount: 0,
          complaintCount: 1,
          b2bUnits: 0,
          releaseDate: '',
          evidence: complaint.issue,
          priority: 'NORMAL',
          status: '검토 대기',
          reviews: [],
          createdAt: new Date().toISOString(),
        });
        return parsed.success ? [parsed.data] : [];
      });
    const ok = await save((current) => [
      ...current,
      ...additions.filter(
        (entry) => !current.some((existing) => existing.id === entry.id),
      ),
    ]);
    if (ok)
      setMessage(
        '유효한 미종결 컴플레인을 가져왔습니다. 중복 항목과 차량·내용이 누락된 기록은 건너뛰었습니다.',
      );
  }
  return (
    <section className="rd-workspace">
      <div className="rd-toolbar">
        <div>
          <h1>개발 요청 · 수요 검토</h1>
          <p>
            Notify Me · 컴플레인 · B2B · 신차 출시 → 개발 판단 → 프로젝트 연결
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
          }}
        >
          개발 요청 등록
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => {
            void importComplaints();
          }}
        >
          컴플레인 가져오기
        </Button>
      </div>
      <p className="rd-note">
        브라우저 저장 데모입니다. Notify Me·B2B·신차 정보는 근거를 직접 등록하며
        외부 시스템과 자동 동기화되지 않습니다. 개발 승인은 실제 회사 결재가
        아닌 검토 기록입니다.
      </p>
      {error && (
        <p role="alert" className="rd-error">
          {error}
        </p>
      )}
      <p role="status">{message}</p>
      {showForm && (
        <form
          className="rd-panel"
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
              status: '검토 대기',
              reviews: [],
              createdAt: new Date().toISOString(),
            });
            if (!result.success) {
              setMessage('입력값과 수요 근거를 확인하세요.');
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
                setMessage('개발 요청을 등록했습니다.');
              }
            });
          }}
        >
          <h2>새 개발 요청</h2>
          <div className="rd-fields">
            <label>
              차량명
              <input
                name="vehicle"
                required
                maxLength={160}
                placeholder="2026 Hyundai Santa Fe"
              />
            </label>
            <label>
              기존 조사 구성 연결
              <select name="configuration">
                <option value="">미연결 · 조사 후 연결</option>
                {configurations.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.vehicle} · {entry.id} ·{' '}
                    {entry.options.map((option) => option[1]).join(' / ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              제품
              <select name="product">
                <option>Seat Cover</option>
                <option>Floor Mat</option>
                <option>Car Cover</option>
              </select>
            </label>
            <label>
              주요 유입 경로
              <select name="source">
                {INTAKE_SOURCES.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
            </label>
            <label>
              출처 번호 / 문서 참조
              <input name="reference" maxLength={300} />
            </label>
            <label>
              Notify Me 건수
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
              컴플레인 건수
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
              B2B 약정 수량
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
              신차 출시 예정일
              <input type="date" name="release" />
            </label>
            <label>
              초기 우선순위
              <select name="priority" defaultValue="NORMAL">
                <option>LOW</option>
                <option>NORMAL</option>
                <option>HIGH</option>
                <option>URGENT</option>
              </select>
            </label>
          </div>
          <label>
            수요 근거 · 개발 필요성
            <textarea name="evidence" required maxLength={2000} rows={3} />
          </label>
          <Button type="submit" disabled={saving}>
            등록
          </Button>
        </form>
      )}
      <div className="rd-panel">
        <div className="rd-toolbar">
          <h2>검토 대기열 · {visible.length}건</h2>
          <label>
            검색
            <input
              value={query}
              onChange={(event) => {
                changeFilter('q', event.target.value);
              }}
            />
          </label>
          <label>
            상태
            <select
              value={filter}
              onChange={(event) => {
                changeFilter('status', event.target.value);
              }}
            >
              <option>전체</option>
              {INTAKE_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="rd-table">
          <table>
            <thead>
              <tr>
                <th>차량 / 제품</th>
                <th>유입 · 수요</th>
                <th>우선순위</th>
                <th>검토 결과</th>
                <th>프로젝트</th>
                <th>검토</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => {
                const linked = linkedIntakeProjects(entry, projects);
                const config = configurations.find(
                  (item) => item.id === entry.configurationId,
                );
                return (
                  <tr key={entry.id}>
                    <td>
                      {entry.vehicle}
                      <br />
                      <small>
                        {entry.product} ·{' '}
                        {entry.configurationId || '구성 미연결'}
                      </small>
                    </td>
                    <td>
                      {entry.source}
                      <br />
                      <small>
                        Notify {entry.notifyCount} / 불만 {entry.complaintCount}{' '}
                        / B2B {entry.b2bUnits}
                        {entry.releaseDate && ` / 출시 ${entry.releaseDate}`}
                      </small>
                    </td>
                    <td>{entry.priority}</td>
                    <td>{entry.status}</td>
                    <td>
                      {linked.length ? (
                        linked.map((project) => (
                          <div key={project.id}>
                            <Link
                              to={'/vehicle-projects?project=' + project.id}
                            >
                              {project.id}
                            </Link>
                          </div>
                        ))
                      ) : entry.status === '개발 승인' &&
                        config?.researchStatus === 'COMPLETE' ? (
                        <Link
                          to={
                            '/vehicle-projects?new=1&configuration=' +
                            encodeURIComponent(config.id) +
                            '&intake=' +
                            encodeURIComponent(entry.id)
                          }
                        >
                          프로젝트 생성 →
                        </Link>
                      ) : (
                        <small>
                          {entry.status === '개발 승인'
                            ? '조사 완료 구성 연결 필요'
                            : '검토 후 생성'}
                        </small>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          changeFilter('request', entry.id);
                        }}
                      >
                        근거 · 검토
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visible.length && (
          <p className="rd-empty">
            등록된 요청이 없습니다. 직접 등록하거나 기존 컴플레인을 가져오세요.
          </p>
        )}
      </div>
      {selected && (
        <form
          key={selected.id + String(selected.reviews.length)}
          className="rd-panel"
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
              if (ok) setMessage('검토 결과와 사유를 기록했습니다.');
            });
          }}
        >
          <h2>{selected.vehicle} · 검토</h2>
          <p className="whitespace-pre-wrap">{selected.evidence}</p>
          <p>출처: {selected.sourceReference || '미입력'}</p>
          <div className="rd-fields">
            <label>
              연결할 조사 구성
              <select
                name="configuration"
                defaultValue={selected.configurationId}
              >
                <option value="">미연결</option>
                {configurations
                  .filter((entry) => entry.vehicle === selected.vehicle)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.id} ·{' '}
                      {entry.options.map((option) => option[1]).join(' / ')}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              검토 결과
              <select name="status" defaultValue={selected.status}>
                {INTAKE_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              우선순위
              <select name="priority" defaultValue={selected.priority}>
                <option>LOW</option>
                <option>NORMAL</option>
                <option>HIGH</option>
                <option>URGENT</option>
              </select>
            </label>
          </div>
          <label>
            검토 · 변경 사유
            <textarea required name="reason" maxLength={1000} rows={2} />
          </label>
          <Button type="submit" disabled={saving}>
            검토 결과 저장
          </Button>
          <div>
            {selected.reviews.map((review, index) => (
              <p key={review.at + String(index)}>
                {review.at.slice(0, 16).replace('T', ' ')} · {review.actor} ·{' '}
                {review.status} / {review.priority} — {review.reason}
              </p>
            ))}
          </div>
        </form>
      )}
    </section>
  );
}

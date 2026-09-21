import { useState, type ChangeEvent } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { RdPerformance } from '@/modules/rd-workspace/rd-performance';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  isOpen,
  isOverdue,
  personName,
  requestLink,
  STATUS_NAMES,
  TEAM_IDS,
  TEAM_NAMES,
  teamFromLocation,
  today,
} from './operations-model';
import { PersonalSettings } from './personal-settings';
import {
  loadPersonalSettings,
  visiblePersonalNotifications,
} from './personal-settings-model';
import { ReportViewTabs } from './report-view-tabs';
import { RequestDetail } from './request-detail';
import { RequestForm } from './request-form';
import { useRdActions } from './use-rd-actions';
import './operations.css';
import './personal-settings.css';

function download(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function OperationsPage() {
  const { snapshot, actor, restore, previousBackup, saving } = useOperations();
  const location = useLocation();
  const { requestId } = useParams();
  const [params, setParams] = useSearchParams();
  const team = teamFromLocation(location.pathname, location.search);
  const query = params.get('q') ?? '';
  const view = params.get('view') ?? 'assigned';
  const filter = params.get('filter') ?? 'all';
  const [backup, setBackup] = useState<unknown>();
  const [backupMessage, setBackupMessage] = useState('');
  const {
    exportSnapshot,
    storageMessage,
    projects,
    masterProducts,
    approvalAssignments,
    approvalSteps,
    approvalRequests,
  } = useWorkbenchStore();
  const myApprovalEntityIds = new Set(
    approvalAssignments
      .filter(
        (entry) => entry.assignedTo === actor.id && entry.status === 'PENDING',
      )
      .flatMap((entry) => {
        const step = approvalSteps.find(
          (candidate) =>
            candidate.id === entry.approvalRequestStepId &&
            candidate.status === 'PENDING',
        );
        const approval = approvalRequests.find(
          (candidate) =>
            candidate.id === step?.approvalRequestId &&
            candidate.status === 'PENDING',
        );
        return approval ? [approval.entityId] : [];
      }),
  );
  const rd = useRdActions();
  const section = location.pathname.split('/')[2] ?? 'tasks';
  const personal = loadPersonalSettings(actor);
  const notifications = visiblePersonalNotifications(
    snapshot.requests,
    actor.id,
    personal.settings,
  );
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  }
  const visible = snapshot.requests
    .filter((request) => {
      if (
        section === 'tasks' &&
        (view === 'assigned'
          ? request.assigneeId !== actor.id
          : view === 'approvals'
            ? request.reviewerId !== actor.id || request.status !== 'review'
            : request.requesterId !== actor.id)
      )
        return false;
      if (
        section !== 'tasks' &&
        section !== 'search' &&
        request.targetTeam !== team &&
        request.sourceTeam !== team
      )
        return false;
      if (params.get('target') && request.targetTeam !== params.get('target'))
        return false;
      if (params.get('category') && request.category !== params.get('category'))
        return false;
      if (filter === 'overdue' && !isOverdue(request)) return false;
      if (
        filter === 'today' &&
        (!isOpen(request) || request.dueDate !== today())
      )
        return false;
      if (filter === 'open' && !isOpen(request)) return false;
      if (filter === 'waiting' && request.status !== 'blocked') return false;
      if (filter === 'review' && request.status !== 'review') return false;
      if (filter === 'done' && request.status !== 'done') return false;
      return [
        request.title,
        request.id,
        request.reference,
        request.description,
        personName(request.assigneeId),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        a.dueDate.localeCompare(b.dueDate),
    );
  async function readBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error('10 MB 이하의 백업을 선택하세요.');
      const parsed: unknown = JSON.parse(await file.text());
      setBackup(parsed);
      setBackupMessage(
        '파일을 읽었습니다. 복원 시 전체 형식을 검증하고 기존 ID는 보존합니다.',
      );
    } catch {
      setBackup(undefined);
      setBackupMessage('백업 파일을 읽을 수 없습니다. JSON 파일을 확인하세요.');
    }
  }
  const titles: Record<string, string> = {
    tasks: 'My Tasks · 업무함',
    requests: '팀 간 요청',
    notifications: '알림 · 나의 활동',
    search: '통합 검색',
    reports: '업무 리포트',
    settings: '개인 환경 설정',
  };
  if (requestId) {
    const request = snapshot.requests.find((entry) => entry.id === requestId);
    return (
      <section className="ops">
        <Link to={'/work/requests?team=' + team}>← 요청 목록</Link>
        {request ? (
          <RequestDetail key={request.id} request={request} />
        ) : (
          <p>요청을 찾을 수 없습니다. 목록에서 확인하세요.</p>
        )}
      </section>
    );
  }
  const content =
    section === 'notifications' ? (
      <div className="ops-panel">
        <h2>나에게 전달된 요청·멘션·상태 변경</h2>
        <p>
          개인 알림 설정에 따라 표시합니다.{' '}
          <Link to={'/work/settings?team=' + team + '#notifications'}>
            알림 설정 변경
          </Link>
        </p>
        {personal.error && <p role="alert">{personal.error}</p>}
        {notifications.map(({ request, event }) => (
          <div className="ops-row" key={event.id}>
            <Link to={requestLink(request.id, team)}>
              {request.title} · {event.message}
            </Link>
            <span>
              {personName(event.actorId)} ·{' '}
              {new Date(event.at).toLocaleString()}
            </span>
          </div>
        ))}
        {!notifications.length && (
          <p>선택한 알림 종류에 표시할 활동이 없습니다.</p>
        )}
      </div>
    ) : section === 'settings' ? (
      <PersonalSettings key={actor.id} actor={actor}>
        <div className="ops-panel ops-form">
          <h2>데모 업무 데이터 백업</h2>
          <p>
            팀 간 요청·댓글·문서 링크·활동 이력을 JSON으로 내보냅니다. 기존 R&D
            데이터는 별도이며 이 백업에 포함되지 않습니다.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              download(
                JSON.stringify(snapshot, null, 2),
                'coverland-requests-' + today() + '.json',
              );
            }}
          >
            현재 요청 데이터 내보내기
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                const previous = previousBackup();
                if (previous)
                  download(previous, 'coverland-requests-previous.json');
                else setBackupMessage('아직 이전 저장본이 없습니다.');
              } catch {
                setBackupMessage('이전 저장본을 읽을 수 없습니다.');
              }
            }}
          >
            이전 저장본 내보내기
          </Button>
          <label>
            백업 파일
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                void readBackup(event);
              }}
            />
          </label>
          <p role="status">{backupMessage}</p>
          <Button
            disabled={!backup || saving}
            onClick={() => {
              void restore(backup).then((success) => {
                if (success) {
                  setBackup(undefined);
                  setBackupMessage(
                    '새 요청을 복원했습니다. 기존 기록은 보존했습니다.',
                  );
                }
              });
            }}
          >
            누락된 요청 복원
          </Button>
          <h2>R&D 데이터 백업</h2>
          <p>
            {storageMessage} · 기존 R&D 데이터의 현재 상태를 내보냅니다. 이
            파일은 요청 백업 복원기에 넣을 수 없습니다.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              download(exportSnapshot(), 'coverland-rd-' + today() + '.json');
            }}
          >
            R&D 데이터 내보내기
          </Button>
          <h2>실사용 연결 준비</h2>
          <p>
            Google 회사 로그인: 설정 대기 · 공용 API/DB: 연결 대기 · 현재 역할
            선택은 테스트용입니다. 실제 회사 정보는 운영 연결 후 입력하세요.
          </p>
        </div>
      </PersonalSettings>
    ) : (
      <>
        {section === 'reports' && (
          <div className="ops-panel">
            <h2>팀별 요청 현황</h2>
            <p>
              기준: 현재 브라우저에 저장된 전체 요청 · 마지막 변경{' '}
              {new Date(snapshot.updatedAt).toLocaleString()} · 완료율 = 완료 /
              취소 제외 전체
            </p>
            <div className="ops-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>수신 팀</th>
                    <th>열린 요청</th>
                    <th>기한 초과</th>
                    <th>승인 대기</th>
                    <th>완료율</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAM_IDS.map((id) => {
                    const rows = snapshot.requests.filter(
                      (request) =>
                        request.targetTeam === id &&
                        request.status !== 'cancelled',
                    );
                    const done = rows.filter(
                      (request) => request.status === 'done',
                    ).length;
                    return (
                      <tr key={id}>
                        <td>{TEAM_NAMES[id]}</td>
                        <td>
                          <Link
                            to={
                              '/work/requests?team=' +
                              id +
                              '&target=' +
                              id +
                              '&filter=open'
                            }
                          >
                            {rows.filter(isOpen).length}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={
                              '/work/requests?team=' +
                              id +
                              '&target=' +
                              id +
                              '&filter=overdue'
                            }
                          >
                            {rows.filter(isOverdue).length}
                          </Link>
                        </td>
                        <td>
                          <Link
                            to={
                              '/work/requests?team=' +
                              id +
                              '&target=' +
                              id +
                              '&filter=review'
                            }
                          >
                            {
                              rows.filter(
                                (request) => request.status === 'review',
                              ).length
                            }
                          </Link>
                        </td>
                        <td>
                          {rows.length
                            ? String(Math.round((done / rows.length) * 100)) +
                              '%'
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="ops-panel">
          <div className="ops-actions">
            <label>
              검색
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  update('q', event.target.value);
                }}
                placeholder="요청 · SKU · 프로젝트 · 담당자"
              />
            </label>
            {section === 'tasks' && (
              <label>
                업무함
                <select
                  value={view}
                  onChange={(event) => {
                    update('view', event.target.value);
                  }}
                >
                  <option value="assigned">내가 처리할 일</option>
                  <option value="approvals">내가 승인할 일</option>
                  <option value="requested">내가 요청한 일</option>
                </select>
              </label>
            )}
            <label>
              상태
              <select
                value={filter}
                onChange={(event) => {
                  update('filter', event.target.value);
                }}
              >
                <option value="all">전체</option>
                <option value="open">미완료</option>
                <option value="today">오늘 마감</option>
                <option value="overdue">기한 초과</option>
                <option value="waiting">응답 대기</option>
                <option value="review">승인 대기</option>
                <option value="done">완료</option>
              </select>
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setParams({ team });
              }}
            >
              조건 초기화
            </Button>
          </div>
          <div className="ops-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>업무 / 관련 자료</th>
                  <th>상태</th>
                  <th>요청 → 수신</th>
                  <th>담당자</th>
                  <th>마감</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <Link to={requestLink(request.id, team)}>
                        {request.title}
                      </Link>
                      <small>
                        {request.reference} · {request.priority}
                      </small>
                    </td>
                    <td>{STATUS_NAMES[request.status]}</td>
                    <td>
                      {TEAM_NAMES[request.sourceTeam]} →{' '}
                      {TEAM_NAMES[request.targetTeam]}
                    </td>
                    <td>{personName(request.assigneeId)}</td>
                    <td className={isOverdue(request) ? 'ops-danger' : ''}>
                      {request.dueDate}
                      {isOverdue(request) && ' · 지연'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="ops-empty">
                조건에 맞는 업무가 없습니다. 필터를 변경하거나 새 요청을
                등록하세요.
              </p>
            )}
          </div>
        </div>
        {section === 'search' && (
          <div className="ops-panel">
            <h2>상품 SKU</h2>
            {masterProducts
              .filter((product) =>
                (product.sku + ' ' + product.fNumber)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .slice(0, 50)
              .map((product) => (
                <div className="ops-row" key={product.id}>
                  <Link
                    to={'/products?product=' + encodeURIComponent(product.id)}
                  >
                    {product.sku} · {product.fNumber}
                  </Link>
                  <span>{product.status}</span>
                </div>
              ))}
            <h2>R&D 프로젝트</h2>
            {projects
              .filter((project) =>
                (project.id + ' ' + project.vehicle)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .slice(0, 50)
              .map((project) => (
                <div className="ops-row" key={project.id}>
                  <Link
                    to={
                      '/vehicle-projects?project=' +
                      encodeURIComponent(project.id)
                    }
                  >
                    {project.id} · {project.vehicle}
                  </Link>
                  <span>{project.stage}</span>
                </div>
              ))}
            <p className="ops-muted">
              최대 50개 표시 · 프로젝트 ID나 차량명으로 검색
            </p>
          </div>
        )}
        {section === 'tasks' && actor.team === 'rd' && (
          <div className="ops-panel">
            <h2>R&D 기존 업무</h2>
            <p>
              아래는 기존 R&D의 담당·승인 배정 기준 참고 목록이며 위 요청 필터와
              별도입니다. 기존 화면에서 처리합니다. 담당 미지정 항목은 팀 확인이
              필요합니다.
            </p>
            {rd.actions
              .filter((action) =>
                view === 'assigned'
                  ? action.ownerId === actor.id
                  : view === 'approvals'
                    ? (action.id.startsWith('handoff-') &&
                        action.ownerId === actor.id) ||
                      myApprovalEntityIds.has(
                        action.id.replace('registration-', ''),
                      )
                    : false,
              )
              .filter((action) =>
                (action.title + ' ' + action.detail)
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((action) => (
                <div className="ops-row" key={action.id}>
                  <Link to={action.to}>{action.title}</Link>
                  <span>
                    {action.badge} · {action.detail}
                  </span>
                </div>
              ))}
            <Link to="/dashboard">담당 미지정 및 전체 R&D 현황 확인 →</Link>
          </div>
        )}
      </>
    );
  return (
    <section className="ops">
      {section !== 'settings' && (
        <div className="ops-heading">
          <div>
            <h1>{titles[section] ?? '업무함'}</h1>
            <p>
              {TEAM_NAMES[team]} · {personName(actor.id)}
            </p>
          </div>
          <Button asChild>
            <Link to={'/work/requests?new=1&team=' + team}>새 요청</Link>
          </Button>
        </div>
      )}
      {section !== 'settings' && params.get('new') === '1' && (
        <RequestForm key={actor.id} team={team} />
      )}
      {section === 'reports' ? (
        <ReportViewTabs operations={content} performance={<RdPerformance />} />
      ) : (
        content
      )}
    </section>
  );
}

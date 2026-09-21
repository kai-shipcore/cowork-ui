import { Link, Navigate, useParams } from 'react-router-dom';
import {
  isOpen,
  isOverdue,
  PEOPLE,
  personName,
  requestLink,
  STATUS_NAMES,
  TEAM_IDS,
  TEAM_NAMES,
} from '@/modules/operations/operations-model';
import { useOperations } from '@/app/operations-store';
import '@/modules/operations/operations.css';

const DESCRIPTIONS = {
  rd: '차량 연구, 제품 개발, 샘플 검증과 출시 인계를 관리합니다.',
  'demand-planning':
    '수요·재고·구매 계획과 다른 팀의 재고 확보 요청을 관리합니다.',
  'customer-services':
    '고객 문의, 반품과 반복 불만을 접수하고 조사 결과를 추적합니다.',
  ecommerce: '상품 출시 인계, 채널 운영과 프로모션 준비를 조율합니다.',
};

export function TeamDashboardPage() {
  const { teamId } = useParams();
  const { snapshot } = useOperations();
  const team = TEAM_IDS.find((id) => id === teamId);
  if (!team) return <Navigate to="/dashboard" replace />;
  const requests = snapshot.requests.filter(
    (request) => request.targetTeam === team,
  );
  const metrics = [
    {
      label: '처리할 요청',
      value: requests.filter(isOpen).length,
      filter: 'open',
    },
    {
      label: '기한 초과',
      value: requests.filter(isOverdue).length,
      filter: 'overdue',
    },
    {
      label: '승인 대기',
      value: requests.filter((request) => request.status === 'review').length,
      filter: 'review',
    },
    {
      label: '완료',
      value: requests.filter((request) => request.status === 'done').length,
      filter: 'done',
    },
  ];
  const members = PEOPLE.filter((person) => person.team === team);
  return (
    <section className="ops">
      <div className="ops-heading">
        <div>
          <h1>{TEAM_NAMES[team]}</h1>
          <p>{DESCRIPTIONS[team]}</p>
        </div>
        <Link to={'/work/requests?new=1&team=' + team}>팀 간 요청 등록 →</Link>
      </div>
      <p>
        Demo 데이터 · 수신 팀 기준 전체 요청 · 최종 갱신{' '}
        {new Date(snapshot.updatedAt).toLocaleString()} · 지표를 선택해 해당
        업무를 처리하세요.
      </p>
      <div className="ops-metrics">
        {metrics.map((metric) => (
          <Link
            className="ops-metric"
            key={metric.label}
            to={
              '/work/requests?team=' +
              team +
              '&target=' +
              team +
              '&filter=' +
              metric.filter
            }
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <span>업무 목록 열기 →</span>
          </Link>
        ))}
      </div>
      <div className="ops-panel">
        <h2>우선 처리할 업무</h2>
        {requests
          .filter(isOpen)
          .sort(
            (a, b) =>
              Number(isOverdue(b)) - Number(isOverdue(a)) ||
              a.dueDate.localeCompare(b.dueDate),
          )
          .slice(0, 8)
          .map((request) => (
            <div className="ops-row" key={request.id}>
              <Link to={requestLink(request.id, team)}>{request.title}</Link>
              <span>
                {STATUS_NAMES[request.status]} ·{' '}
                {personName(request.assigneeId)} · {request.dueDate}
              </span>
            </div>
          ))}
        {!requests.some(isOpen) && <p>처리 대기 중인 요청이 없습니다.</p>}
      </div>
      <div className="ops-panel">
        <h2>팀 역할 · 업무 분담</h2>
        <p>아래 구성원은 역할 테스트를 위한 데모 사용자입니다.</p>
        {members.map((person) => (
          <div className="ops-row" key={person.id}>
            <strong>{person.name}</strong>
            <span>
              {person.role === 'lead'
                ? '완료 검토 및 반려'
                : '접수·작업·자료 등록'}{' '}
              · 진행{' '}
              {
                requests.filter(
                  (request) =>
                    request.assigneeId === person.id && isOpen(request),
                ).length
              }
              건 · 검토{' '}
              {
                requests.filter(
                  (request) =>
                    request.reviewerId === person.id &&
                    request.status === 'review',
                ).length
              }
              건
            </span>
          </div>
        ))}
      </div>
      <div className="ops-panel">
        <h2>업무 지표 연결 상태</h2>
        <p>
          {team === 'demand-planning'
            ? '수요 정확도·품절 예상·발주량은 재고/판매 데이터 연결 후 제공됩니다.'
            : team === 'customer-services'
              ? '고객 만족도·응답 SLA·환불 금액은 고객 문의 및 주문 데이터 연결 후 제공됩니다.'
              : '매출·리스팅 오류·채널 재고는 판매 채널 데이터 연결 후 제공됩니다.'}
        </p>
        <Link to={'/work/reports?team=' + team}>현재 요청 데이터 리포트 →</Link>
      </div>
    </section>
  );
}

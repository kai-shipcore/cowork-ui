import { Link, useLocation } from 'react-router-dom';
import { useOperations } from '@/app/operations-store';
import { requestLink, STATUS_NAMES } from './operations-model';

export function RelatedRequests() {
  const { pathname, search } = useLocation();
  const { snapshot } = useOperations();
  const key =
    pathname === '/vehicle-projects'
      ? 'project'
      : pathname === '/products'
        ? 'product'
        : '';
  const reference = new URLSearchParams(search).get(key);
  if (!key || !reference) return null;
  const requests = snapshot.requests.filter((request) => {
    if (!request.referencePath) return false;
    const ref = new URL(request.referencePath, 'https://workbench.invalid');
    return ref.pathname === pathname && ref.searchParams.get(key) === reference;
  });
  return (
    <section className="ops mt-5">
      <div className="ops-panel">
        <h2>연결된 팀 간 요청 · 활동 기록</h2>
        {requests.map((request) => (
          <div className="ops-row" key={request.id}>
            <Link to={requestLink(request.id, 'rd')}>{request.title}</Link>
            <span>
              {STATUS_NAMES[request.status]} · {request.events.length}개 기록
            </span>
          </div>
        ))}
        {requests.length === 0 && <p>이 업무에 연결된 요청이 없습니다.</p>}
        <Link
          to={
            '/work/requests?new=1&team=rd&reference=' +
            encodeURIComponent(reference)
          }
        >
          이 업무에 팀 간 요청 등록 →
        </Link>
      </div>
    </section>
  );
}

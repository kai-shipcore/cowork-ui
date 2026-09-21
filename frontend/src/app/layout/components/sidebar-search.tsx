import { Input } from '@coverland-engineering/ui/input';
import { useLocation, useNavigate } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';

export function SidebarSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <form
      className="px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const query = data.get('query');
        const params = new URLSearchParams({
          team: teamFromLocation(location.pathname, location.search),
          q: typeof query === 'string' ? query : '',
        });
        void navigate('/work/search?' + params.toString());
      }}
    >
      <Input
        name="query"
        type="search"
        aria-label="업무 통합 검색 후 Enter"
        placeholder="업무 검색 · Enter"
      />
    </form>
  );
}

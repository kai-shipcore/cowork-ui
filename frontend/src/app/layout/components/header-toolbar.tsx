import { Button } from '@coverland-engineering/ui/button';
import { Bell, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';
import { HeaderUserMenu } from './header-user-menu';

export function HeaderToolbar() {
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  return (
    <nav aria-label="Workspace actions" className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={'/work/search?team=' + team}>Search</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link to={'/work/reports?team=' + team}>Reports</Link>
      </Button>
      <Button
        asChild
        mode="icon"
        variant="outline"
        aria-label="My notifications"
      >
        <Link to={'/work/notifications?team=' + team}>
          <Bell />
        </Link>
      </Button>
      <Button asChild size="sm">
        <Link to={'/work/requests?new=1&team=' + team}>
          <Plus /> Requests
        </Link>
      </Button>
      <HeaderUserMenu team={team} />
    </nav>
  );
}

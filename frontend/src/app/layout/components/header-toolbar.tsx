import { Button } from '@coverland-engineering/ui/button';
import { Bell, Moon, Plus, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link, useLocation } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';

export function HeaderToolbar() {
  const { theme, setTheme } = useTheme();
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  return (
    <nav aria-label="Workspace actions" className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link to={'/work/search?team=' + team}>검색</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link to={'/work/reports?team=' + team}>Reports</Link>
      </Button>
      <Button asChild mode="icon" variant="outline" aria-label="나의 알림">
        <Link to={'/work/notifications?team=' + team}>
          <Bell />
        </Link>
      </Button>
      <Button asChild size="sm">
        <Link to={'/work/requests?new=1&team=' + team}>
          <Plus /> 요청
        </Link>
      </Button>
      <Button
        mode="icon"
        variant="ghost"
        aria-label="테마 변경"
        onClick={() => {
          setTheme(theme === 'dark' ? 'light' : 'dark');
        }}
      >
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>
    </nav>
  );
}

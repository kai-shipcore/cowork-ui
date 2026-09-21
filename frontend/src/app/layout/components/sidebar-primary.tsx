import { Button } from '@coverland-engineering/ui/button';
import { BarChart3, Bell, ClipboardList, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { teamFromLocation } from '@/modules/operations/operations-model';

export function SidebarPrimary({
  dashboardPath = '/dashboard',
}: {
  dashboardPath?: string;
}) {
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  const links = [
    { label: 'Dashboard', path: dashboardPath, icon: BarChart3 },
    {
      label: 'My Tasks',
      path: '/work/tasks?team=' + team,
      icon: ClipboardList,
    },
    { label: '알림', path: '/work/notifications?team=' + team, icon: Bell },
    { label: '설정', path: '/work/settings?team=' + team, icon: Settings },
  ];
  return (
    <nav
      aria-label="Quick navigation"
      className="flex flex-col items-center gap-3 px-2.5 py-3 w-(--sidebar-collapsed-width) shrink-0 border-e border-border bg-muted"
    >
      {links.map((item) => (
        <Button
          key={item.label}
          asChild
          mode="icon"
          variant={pathname === item.path.split('?')[0] ? 'primary' : 'ghost'}
          title={item.label}
          aria-label={item.label}
        >
          <Link to={item.path}>
            <item.icon className="size-4" />
          </Link>
        </Button>
      ))}
    </nav>
  );
}

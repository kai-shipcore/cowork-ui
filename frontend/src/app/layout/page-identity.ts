import { ROUTES } from '@/constants/routes';
import {
  TEAM_NAMES,
  teamFromLocation,
} from '@/modules/operations/operations-model';
import { MENU_SIDEBAR_ALL, type MenuItem } from './navigation';

/** Route-aware headings shared by the browser title and breadcrumbs. */
export function pageTitle(pathname: string, search: string): string {
  const team = teamFromLocation(pathname, search);
  if (pathname === ROUTES.dashboard) return 'Team Overview';
  if (pathname.startsWith('/dashboard')) return TEAM_NAMES[team] + ' Dashboard';
  const pages: Record<string, string> = {
    tasks: 'My Tasks',
    requests: 'Team Requests',
    search: 'Global Search',
    reports: 'Work Reports',
    notifications: 'Notifications & Activity',
    settings: 'Personal Settings',
  };
  if (pathname.startsWith('/work/'))
    return pages[pathname.split('/')[2]] ?? 'Work';
  function find(items: MenuItem[]): string | undefined {
    for (const item of items) {
      if (item.path === pathname) return item.title;
      const child = item.children ? find(item.children) : undefined;
      if (child) return child;
    }
    return undefined;
  }
  return find(MENU_SIDEBAR_ALL) ?? 'Coverland Workbench';
}

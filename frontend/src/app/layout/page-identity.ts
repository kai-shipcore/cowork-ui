import {
  TEAM_NAMES,
  teamFromLocation,
} from '@/modules/operations/operations-model';
import { MENU_SIDEBAR_ALL, type MenuItem } from './navigation';

/** Route-aware headings shared by the browser title and breadcrumbs. */
export function pageTitle(pathname: string, search: string): string {
  const team = teamFromLocation(pathname, search);
  if (pathname.startsWith('/dashboard')) return TEAM_NAMES[team] + ' Dashboard';
  const pages: Record<string, string> = {
    tasks: 'My Tasks',
    requests: '팀 간 요청',
    search: '통합 검색',
    reports: '업무 리포트',
    notifications: '알림 · 활동',
    settings: '데이터 · 운영 설정',
  };
  if (pathname.startsWith('/work/'))
    return pages[pathname.split('/')[2]] ?? '업무';
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

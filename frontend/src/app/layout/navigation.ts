import {
  BarChart2,
  BarChart3,
  Bell,
  Bolt,
  Briefcase,
  Calendar,
  CalendarDays,
  ChartLine,
  ChartNoAxesCombined,
  ClipboardList,
  Cog,
  FolderKanban,
  GitPullRequest,
  Grid,
  Handshake,
  Headphones,
  House,
  MessageSquare,
  Package,
  Palette,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  TrendingUp,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { teamHome, type TeamId } from '@/modules/operations/operations-model';

export interface MenuItem {
  title?: string;
  desc?: string;
  img?: string;
  icon?: LucideIcon;
  path?: string;
  rootPath?: string;
  childrenIndex?: number;
  heading?: string;
  children?: MenuConfig;
  disabled?: boolean;
  collapse?: boolean;
  collapseTitle?: string;
  expandTitle?: string;
  badge?: string;
  separator?: boolean;
}

export type MenuConfig = MenuItem[];

type WorkspaceMenu = Record<
  | 'home'
  | 'tasks'
  | 'requests'
  | 'notifications'
  | 'reports'
  | 'settings'
  | 'search',
  Required<Pick<MenuItem, 'title' | 'path' | 'icon'>>
>;

/** One destination definition for both the icon rail and labelled sidebar. */
export function getWorkspaceMenu(
  team: TeamId,
  dashboardPath = teamHome(team),
): WorkspaceMenu {
  return {
    home: { title: 'Home', path: dashboardPath, icon: House },
    tasks: {
      title: 'My Tasks',
      path: '/work/tasks?team=' + team,
      icon: ClipboardList,
    },
    requests: {
      title: 'Team Requests',
      path: '/work/requests?team=' + team,
      icon: GitPullRequest,
    },
    notifications: {
      title: 'Notifications & Activity',
      path: '/work/notifications?team=' + team,
      icon: Bell,
    },
    reports: {
      title: 'Work Reports',
      path: '/work/reports?team=' + team,
      icon: BarChart3,
    },
    settings: {
      title: 'Settings',
      path: '/work/settings?team=' + team,
      icon: Settings,
    },
    search: {
      title: 'Global Search',
      path: '/work/search?team=' + team,
      icon: Search,
    },
  };
}

/** R&D performance report as its own screen; other teams have no report yet. */
const PERFORMANCE_DASHBOARD: Required<
  Pick<MenuItem, 'title' | 'path' | 'icon'>
> = {
  title: 'Performance Dashboard',
  path: ROUTES.performanceDashboard,
  icon: ChartNoAxesCombined,
};

/** Top shortcuts shared by the icon rail and the labelled sidebar, in display order. */
export function getWorkspaceLinks(
  team: TeamId,
  dashboardPath?: string,
): MenuItem[] {
  const menu = getWorkspaceMenu(team, dashboardPath);
  return [
    menu.home,
    ...(team === 'rd' ? [PERFORMANCE_DASHBOARD] : []),
    menu.tasks,
    menu.notifications,
  ];
}

/** Match a destination and its detail routes without matching unrelated prefixes. */
export function isSidebarLinkActive(pathname: string, path: string): boolean {
  const destination = path.split('?')[0];
  return (
    destination !== '#' &&
    (pathname === destination || pathname.startsWith(destination + '/'))
  );
}

const RD_WORKSPACE_MENU = getWorkspaceMenu('rd');

export const MENU_SIDEBAR_MAIN: MenuConfig = [
  {
    children: [
      RD_WORKSPACE_MENU.home,
      PERFORMANCE_DASHBOARD,
      RD_WORKSPACE_MENU.tasks,
      RD_WORKSPACE_MENU.notifications,
    ],
  },
  {
    title: 'R&D Tools',
    children: [
      {
        title: 'Vehicle Research',
        path: ROUTES.vehicleResearch,
        icon: Search,
      },
      {
        title: 'Vehicle Projects',
        path: ROUTES.vehicleProjects,
        icon: FolderKanban,
      },
      { title: 'Part Management', path: '/parts', icon: Package },
      { title: 'Shape', path: ROUTES.productShapes, icon: Grid },
      {
        title: 'Hunt Board',
        path: ROUTES.huntBoard,
        icon: CalendarDays,
      },
      {
        title: 'Sample Tracker',
        path: ROUTES.samples,
        icon: Package,
      },
    ],
  },
];

export const MENU_SIDEBAR_TEAM_TOOLS: Partial<Record<string, MenuConfig>> = {
  'Planning Tools': [
    { title: 'Demand Forecast', icon: TrendingUp },
    { title: 'Inventory Planning', icon: Warehouse },
    { title: 'Purchase Planning', icon: ClipboardList },
    { title: 'Planning Calendar', icon: CalendarDays },
  ],
  'Customer Service Tools': [
    { title: 'Customer Inquiries', icon: MessageSquare },
    { title: 'Returns & Refunds', icon: RotateCcw },
    { title: 'Case Management', icon: Headphones },
    { title: 'Service Reports', icon: BarChart2 },
  ],
  'eCommerce Tools': [
    { title: 'Listing Management', icon: Store },
    { title: 'Channel Operations', icon: ShoppingCart },
    { title: 'Promotion Calendar', icon: Tags },
    { title: 'Sales Analytics', icon: ChartLine },
  ],
};

export const MENU_SIDEBAR_RESOURCES: MenuConfig = [
  {
    title: 'Resources',
    children: [
      {
        title: 'Vehicle Options',
        path: ROUTES.vehicleOptions,
        icon: Cog,
      },
      {
        title: 'Reference Data',
        path: ROUTES.referenceData,
        icon: Palette,
      },
    ],
  },
];

/** Company storefronts; every team gets these under Resources. */
export const MENU_SIDEBAR_SITE_LINKS: MenuItem[] = [
  {
    title: 'Coverland',
    path: 'https://www.coverland.com',
    img: '/brand/coverland-favicon.ico',
  },
  {
    title: 'iCarCover',
    path: 'https://www.icarcover.com',
    img: '/brand/icarcover-favicon.png',
  },
];

/** R&D keeps its reference tools; other teams see only the site shortcuts. */
export function getResourcesMenu(team: TeamId): MenuItem[] {
  const teamItems =
    team === 'rd'
      ? MENU_SIDEBAR_RESOURCES.flatMap((group) => group.children ?? [])
      : [];
  return [...teamItems, ...MENU_SIDEBAR_SITE_LINKS];
}

/** External shortcuts open in a new tab and never count as the current page. */
export function isExternalPath(path?: string): boolean {
  return /^https?:\/\//.test(path ?? '');
}

export const MENU_SIDEBAR_WORKSPACES: MenuConfig = [
  {
    title: 'Workspaces',
    children: [
      {
        title: 'Business Concepts',
        path: '#',
        icon: Briefcase,
      },
      {
        title: 'KeenThemes Studio',
        path: '#',
        icon: Palette,
      },
      {
        title: 'Teams',
        path: '#',
        icon: Handshake,
        badge: 'Pro',
      },
      {
        title: 'Reports',
        path: '#',
        icon: BarChart2,
      },
    ],
  },
];

export const MENU_SIDEBAR_ALL: MenuConfig = [
  ...MENU_SIDEBAR_MAIN,
  ...MENU_SIDEBAR_RESOURCES,
];

export const MENU_TOOLBAR: MenuConfig = [
  {
    title: 'List',
    path: ROUTES.dashboard,
    icon: ClipboardList,
  },
  {
    title: 'Kanban',
    path: '#',
    icon: Grid,
  },
  {
    title: 'Calendar',
    path: '#',
    icon: Calendar,
  },
  {
    title: 'Dashboard',
    path: '#',
    icon: Bolt,
  },
];

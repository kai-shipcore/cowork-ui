import {
  BarChart2,
  Bolt,
  Briefcase,
  Calendar,
  CalendarDays,
  CarFront,
  ChartLine,
  ClipboardList,
  Cog,
  Download,
  FileChartLine,
  FolderKanban,
  Grid,
  Handshake,
  Megaphone,
  Newspaper,
  Package,
  PackageCheck,
  Palette,
  Search,
  SquareActivity,
  UserRoundCog,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';

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

export const MENU_SIDEBAR_MAIN: MenuConfig = [
  {
    children: [
      {
        title: 'Home',
        path: '#',
        icon: Bolt,
      },
      {
        title: 'Updates',
        path: ROUTES.dashboard,
        icon: Users,
      },
      {
        title: 'Inbox',
        path: '#',
        icon: UserRoundCog,
      },
      {
        title: 'Clients',
        path: '#',
        icon: Cog,
        badge: 'Beta',
      },
      {
        title: 'My Tasks',
        path: '#',
        icon: ChartLine,
      },
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
      {
        title: 'Hunt Board',
        path: ROUTES.huntBoard,
        icon: CalendarDays,
      },
      {
        title: 'Rework / Complaints',
        path: ROUTES.reworkComplaints,
        icon: Wrench,
      },
      {
        title: 'Samples',
        path: ROUTES.samples,
        icon: Package,
      },
      {
        title: 'Unique Vehicles / F#',
        path: ROUTES.uniqueVehicles,
        icon: CarFront,
      },
      {
        title: 'Product Catalog',
        path: ROUTES.products,
        icon: Grid,
      },
      {
        title: 'Product Registrations',
        path: ROUTES.productRegistrations,
        icon: PackageCheck,
      },
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

export const MENU_SIDEBAR_RESOURCES: MenuConfig = [
  {
    title: 'Resources',
    children: [
      {
        title: 'About Coverland',
        path: '#',
        icon: Download,
      },
      {
        title: 'Advertise',
        path: '#',
        icon: FileChartLine,
        badge: 'Pro',
      },
      {
        title: 'Help',
        path: '#',
        icon: SquareActivity,
      },
      {
        title: 'Blog',
        path: '#',
        icon: Newspaper,
      },
      {
        title: 'Careers',
        path: '#',
        icon: Briefcase,
      },
      {
        title: 'Press',
        path: '#',
        icon: Megaphone,
      },
    ],
  },
];

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

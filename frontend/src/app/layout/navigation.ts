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
  FolderKanban,
  Grid,
  Handshake,
  Headphones,
  MessageSquare,
  Package,
  PackageCheck,
  Palette,
  RotateCcw,
  Search,
  ShoppingCart,
  Store,
  Tags,
  TrendingUp,
  Warehouse,
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
        path: ROUTES.dashboard,
        icon: Bolt,
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
      {
        title: 'Unique Vehicles / F#',
        path: ROUTES.uniqueVehicles,
        icon: CarFront,
      },
      {
        title: 'Product Registrations',
        path: ROUTES.productRegistrations,
        icon: PackageCheck,
      },
      {
        title: 'Product Catalog',
        path: ROUTES.products,
        icon: Grid,
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

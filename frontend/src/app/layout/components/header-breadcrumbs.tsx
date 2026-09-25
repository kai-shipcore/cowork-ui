import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import type { VehicleConfiguration } from '@/shared/types/workbench';
import {
  TEAM_NAMES,
  teamFromLocation,
  teamHome,
} from '@/modules/operations/operations-model';
import { vehicleResearchIdentity } from '@/modules/vehicle-registry/vehicle-research-grid-model';
import { useWorkbenchStore } from '@/app/workbench-store';
import { pageTitle } from '../page-identity';

interface BreadcrumbItem {
  label: string;
  to: string;
}

export function buildHeaderBreadcrumbs(
  pathname: string,
  search: string,
  configurations: readonly VehicleConfiguration[],
): BreadcrumbItem[] {
  const team = teamFromLocation(pathname, search);
  const items: BreadcrumbItem[] = [
    { label: TEAM_NAMES[team], to: teamHome(team) },
  ];
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] === 'vehicle-research' && segments[1]) {
    const configurationId = decodeURIComponent(segments[1]);
    const configuration = configurations.find(
      (item) => item.id === configurationId,
    );
    const vehicleName = configuration
      ? vehicleResearchIdentity(configuration.vehicle).makeModel
      : configurationId;
    items.push(
      { label: 'Vehicle Research', to: ROUTES.vehicleResearch },
      {
        label: vehicleName,
        to: `/vehicle-research/${encodeURIComponent(configurationId)}`,
      },
    );
    if (segments[2] === 'configurations' && segments[3]) {
      items.push({
        label: 'Research Configuration',
        to: `${pathname}${search}`,
      });
    }
    return items;
  }

  items.push({
    label: pageTitle(pathname, search),
    to: `${pathname}${search}`,
  });
  return items;
}

export function HeaderBreadcrumbs() {
  const { pathname, search } = useLocation();
  const { configurations } = useWorkbenchStore();
  const items = buildHeaderBreadcrumbs(pathname, search, configurations);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-2 text-xs mb-4 lg:mb-0"
    >
      {items.map((item, index) => (
        <span className="contents" key={`${item.to}-${item.label}`}>
          {index > 0 && <span aria-hidden="true">/</span>}
          <Link
            className={
              index === items.length - 1
                ? 'max-w-52 truncate font-medium text-foreground'
                : 'max-w-52 truncate text-muted-foreground hover:text-foreground'
            }
            aria-current={index === items.length - 1 ? 'page' : undefined}
            to={item.to}
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

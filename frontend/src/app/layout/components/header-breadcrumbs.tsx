import { Link, useLocation } from 'react-router-dom';
import {
  TEAM_NAMES,
  teamFromLocation,
  teamHome,
} from '@/modules/operations/operations-model';
import { pageTitle } from '../page-identity';

export function HeaderBreadcrumbs() {
  const { pathname, search } = useLocation();
  const team = teamFromLocation(pathname, search);
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs mb-4 lg:mb-0"
    >
      <Link className="text-muted-foreground" to={teamHome(team)}>
        {TEAM_NAMES[team]}
      </Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{pageTitle(pathname, search)}</span>
    </nav>
  );
}

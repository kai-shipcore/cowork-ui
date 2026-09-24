import { useRdRecords } from '@/modules/rd-workspace/use-rd-records';
import {
  APPROVAL_ROUTE_TEMPLATE_KEY,
  APPROVAL_ROUTE_TEMPLATE_SEED,
  routeTemplateListSchema,
} from './approval-route-template';

/** Default routes per approval type, kept in the browser until the API carries them. */
export function useApprovalRouteTemplates() {
  return useRdRecords(
    APPROVAL_ROUTE_TEMPLATE_KEY,
    routeTemplateListSchema,
    APPROVAL_ROUTE_TEMPLATE_SEED,
  );
}

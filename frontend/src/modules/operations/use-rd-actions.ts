import {
  summarizeDashboard,
  type DashboardSummary,
} from '@/modules/dashboard/dashboard-model';
import { useWorkbenchStore } from '@/app/workbench-store';
import { today } from './operations-model';

/** Reuses R&D's existing gates and records instead of duplicating approval actions. */
export function useRdActions(): DashboardSummary {
  const state = useWorkbenchStore();
  return summarizeDashboard({ ...state, today: today() });
}

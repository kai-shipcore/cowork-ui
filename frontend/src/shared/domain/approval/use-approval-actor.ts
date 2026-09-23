import { CURRENT_USER_ID } from '@/app/current-user';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';

/**
 * Who approves right now. The demo actor picker in the header wins when it
 * names a Workbench user, so multi-approver routes can be walked through;
 * otherwise the session identity applies.
 */
export function useApprovalActor(): string {
  const { actor } = useOperations();
  const { appUsers } = useWorkbenchStore();
  return appUsers.some((user) => user.id === actor.id)
    ? actor.id
    : CURRENT_USER_ID;
}

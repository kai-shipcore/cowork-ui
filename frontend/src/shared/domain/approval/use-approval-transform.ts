import { useWorkbenchStore, type WorkbenchState } from '@/app/workbench-store';

/**
 * Applies a domain transform to the workbench store and reports its error as
 * text. The transform runs once against the rendered state so the message
 * reflects what the user sees, then against the latest state for the write.
 */
export function useApprovalTransform(): (
  transform: (state: WorkbenchState) => WorkbenchState,
) => string | undefined {
  const state = useWorkbenchStore();
  return (transform) => {
    try {
      transform(state);
      state.updateWorkbench((latest) => {
        try {
          return transform(latest);
        } catch {
          return latest;
        }
      });
      return undefined;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'Unable to complete this action.';
    }
  };
}

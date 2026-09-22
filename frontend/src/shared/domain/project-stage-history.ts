import {
  stageTarget,
  type StageDurationRevision,
} from '@/app/stage-duration-model';
import type { ProjectDetailSnapshot } from '../types/workbench';

/** Preserve earlier history without inventing the unknown start of legacy stages. */
export function recordStageTransitions(
  previous: ProjectDetailSnapshot | undefined,
  next: ProjectDetailSnapshot,
  actor: string,
  now = new Date().toISOString(),
  standards: readonly StageDurationRevision[] = [],
): ProjectDetailSnapshot {
  return {
    ...next,
    zones: next.zones.map((zone) => {
      const old = previous?.zones.find((row) => row.id === zone.id);
      const history = old?.stageHistory ?? zone.stageHistory ?? [];
      if (!old || old.currentStage === zone.currentStage)
        return {
          ...zone,
          stageHistory: history,
          lastActivityAt: old?.lastActivityAt ?? zone.lastActivityAt,
        };
      return {
        ...zone,
        lastActivityAt: now,
        stageHistory: [
          ...history.map((row) =>
            row.completedAt
              ? row
              : { ...row, completedAt: now, completedBy: actor },
          ),
          {
            id: crypto.randomUUID(),
            stage: zone.currentStage,
            stageSequence:
              Math.max(0, ...history.map((row) => row.stageSequence)) + 1,
            startedAt: now,
            startedBy: actor,
            ...stageTarget(
              standards,
              zone.productTypeId,
              zone.currentStage,
              now,
              zone.priority ?? 'NORMAL',
              zone.stageTargetDays,
            ),
          },
        ],
      };
    }),
  };
}

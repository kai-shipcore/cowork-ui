import type {
  ProjectDetailSnapshot,
  VehicleProjectGroup,
  Visit,
} from '@/shared/types/workbench';
import { handoffReady } from '@/modules/product-shapes/shape-model';

export function huntRow(
  project: VehicleProjectGroup,
  detail: ProjectDetailSnapshot | undefined,
  visits: readonly Visit[],
  kind: Visit['kind'],
) {
  const relevant = visits.filter(
    (v) => v.projectGroupId === project.id && v.kind === kind,
  );
  const completed = project.zoneProjects.filter((zone) => {
    if (kind === 'SCAN')
      return (
        ['Design', 'Sample', 'Fitting', 'Approved'].includes(
          zone.currentStage,
        ) ||
        (detail?.zones.some((z) => z.id === zone.id && z.scanned) ?? false) ||
        relevant.some(
          (v) =>
            v.status === 'COMPLETED' && v.vehicleProjectIds.includes(zone.id),
        )
      );
    const designs =
      detail?.designs.filter((d) => d.vehicleProjectId === zone.id) ?? [];
    return (
      zone.currentStage === 'Approved' ||
      (designs.length > 0 &&
        designs.every((d) => d.fittingConfirmed) &&
        detail?.zones.some(
          (z) =>
            z.id === zone.id &&
            Boolean(z.productionHandoff) &&
            handoffReady(z, detail.designs, detail.visits),
        ))
    );
  });
  const remaining = project.zoneProjects.filter(
    (z) => !completed.some((c) => c.id === z.id),
  );
  const done = project.zoneProjects.length > 0 && remaining.length === 0;
  const eligible =
    kind === 'SCAN'
      ? project.product !== 'Car Cover' &&
        (done ||
          project.zoneProjects.some((z) =>
            ['Scan', 'Vehicle Hunt'].includes(z.currentStage),
          ))
      : done || project.zoneProjects.some((z) => z.currentStage === 'Fitting');
  const scheduled = relevant
    .filter(
      (v) =>
        v.status === 'SCHEDULED' &&
        v.vehicleProjectIds.some((id) => remaining.some((z) => z.id === id)),
    )
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 1)
    .pop();
  // A visit date is evidence of the visit, not an invented project completion timestamp.
  const completedDate =
    relevant
      .filter((v) => v.status === 'COMPLETED' && v.result !== 'FAIL')
      .map((v) => v.date)
      .sort()
      .pop() ?? '';
  return {
    project,
    completed,
    remaining,
    done,
    eligible,
    scheduled,
    completedDate,
  };
}

export type HuntRow = ReturnType<typeof huntRow>;

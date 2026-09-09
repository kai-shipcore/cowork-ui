import type { ProjectTask, ProjectVisit } from '../types/workbench';

export type NewVisitInput = Pick<
  ProjectVisit,
  | 'type'
  | 'dealer'
  | 'date'
  | 'time'
  | 'vehicleProjectIds'
  | 'staffIds'
  | 'locationType'
  | 'priority'
  | 'note'
  | 'targetVehicleResearchId'
>;

/** One field visit, its staff, and direct field_visit_x_vehicle_project rows. */
export function createProjectVisit(input: NewVisitInput): ProjectVisit {
  const id = `VS-${crypto.randomUUID()}`;
  const vehicleProjectIds = [...new Set(input.vehicleProjectIds)];
  return {
    ...input,
    id,
    vehicleProjectIds,
    staffIds: [...new Set(input.staffIds ?? [])],
    scheduledAt: new Date(`${input.date}T${input.time}`).toISOString(),
    status: 'SCHEDULED',
    projectLinks: vehicleProjectIds.map((vehicleProjectId) => ({
      id: crypto.randomUUID(),
      fieldVisitId: id,
      vehicleProjectId,
      type: input.type,
      targetVehicleResearchId: input.targetVehicleResearchId || undefined,
    })),
  };
}

/** Preserve people on older saved visits while retiring task-based scheduling. */
export function migrateVisitStaff(
  visit: { staffIds?: readonly string[]; taskIds?: readonly string[] },
  tasks: readonly ProjectTask[],
): readonly string[] {
  return (
    visit.staffIds ?? [
      ...new Set(
        tasks.flatMap((task) =>
          visit.taskIds?.includes(task.id) && task.assignedTo
            ? [task.assignedTo]
            : [],
        ),
      ),
    ]
  );
}

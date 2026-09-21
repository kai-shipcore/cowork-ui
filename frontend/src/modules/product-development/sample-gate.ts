import { canApproveRevisionSample } from '@/shared/domain/revision-control';
import type {
  ProductType,
  ProjectDesign,
  SampleRequestItem,
} from '@/shared/types/workbench';

export interface SampleGate {
  ready: boolean;
  blockers: readonly { message: string; tab: 'designs' | 'samples' }[];
}

/** The banner, approval panel, and stage transition share the same evidence. */
export function getSampleGate(
  product: ProductType,
  zones: readonly { id: string; code: string }[],
  designs: readonly ProjectDesign[],
  items: readonly SampleRequestItem[],
): SampleGate {
  const blockers: { message: string; tab: 'designs' | 'samples' }[] = [];
  if (!zones.length)
    blockers.push({ message: 'No target zone project.', tab: 'designs' });
  for (const zone of zones) {
    const zoneDesigns = designs.filter(
      (design) => design.vehicleProjectId === zone.id,
    );
    if (!zoneDesigns.length) {
      blockers.push({
        message: `${zone.code}: ${product === 'Car Cover' ? 'Full pattern' : product === 'Floor Mat' ? 'Mold' : 'Part / Design'} is missing. Register or link it first.`,
        tab: 'designs',
      });
    }
    for (const design of zoneDesigns) {
      if (design.requiresRevisionAfterReview) {
        blockers.push({
          message: `${design.name}: Pattern rework was requested in Shape review. Add a revised version and request new samples.`,
          tab: 'designs',
        });
        continue;
      }
      const revision = design.revisions.reduce<
        ProjectDesign['revisions'][number] | undefined
      >(
        (latest, item) =>
          !latest || item.revisionNumber > latest.revisionNumber
            ? item
            : latest,
        undefined,
      );
      if (!revision) {
        blockers.push({
          message: `${design.name}: Register a revision first.`,
          tab: 'designs',
        });
        continue;
      }
      const revisionItems = items.filter(
        (item) =>
          item.vehicleProductDesignId === design.id &&
          item.vehicleProductDesignRevisionId === revision.id,
      );
      const label = `${design.name} · Rev ${revision.revisionNumber}`;
      if (!revisionItems.length) {
        blockers.push({
          message: `${label}: No sample request for the current revision. Create a new sample request.`,
          tab: 'samples',
        });
      } else if (!revisionItems.some((item) => item.sampleReceivedAt)) {
        blockers.push({
          message: `${label}: Record sample receipt first.`,
          tab: 'samples',
        });
      } else if (
        !revisionItems.some((item) => canApproveRevisionSample(revision, item))
      ) {
        blockers.push({
          message: `${label}: Check drawing match and change implementation in item inspection.`,
          tab: 'samples',
        });
      } else if (product !== 'Floor Mat' && !revision.sampleApprovedAt) {
        blockers.push({
          message: `${label}: Approve the current revision in Sample Approval. This is separate from the request's APPROVED status.`,
          tab: 'samples',
        });
      }
    }
  }
  return { ready: blockers.length === 0, blockers };
}

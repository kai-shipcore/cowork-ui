import type { ProductType, ProjectStage, ProjectVisit } from '@/shared/types/workbench';

export function defaultVisitType(product: ProductType, stage: ProjectStage): ProjectVisit['type'] {
  return product === 'Car Cover' || stage === 'Fitting' || stage === 'Approved' ? 'FITTING' : 'SCAN';
}

export function visitTimestamp(visit: ProjectVisit, completed = false): number {
  const value = Date.parse((completed && visit.performedAt) || `${visit.date}T${visit.time}`);
  return Number.isFinite(value) ? value : 0;
}

export function visitHistory(visits: readonly ProjectVisit[], type: ProjectVisit['type'], includeCancelled: boolean) {
  const selected = visits.filter(v => v.type === type);
  const completed = selected.filter(v => v.status === 'COMPLETED').sort((a,b) => visitTimestamp(a,true)-visitTimestamp(b,true));
  return {
    upcoming: selected.filter(v=>v.status === 'SCHEDULED').sort((a,b)=>visitTimestamp(a)-visitTimestamp(b)),
    past: selected.filter(v=>v.status === 'COMPLETED' || (includeCancelled && v.status === 'CANCELLED')).sort((a,b)=>visitTimestamp(b,true)-visitTimestamp(a,true)),
    latest: completed[completed.length - 1],
    rounds: new Map(completed.map((v,i)=>[v.id,i+1])),
    cancelled: selected.filter(v=>v.status === 'CANCELLED').length,
  };
}

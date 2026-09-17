import type { SampleRequestItem } from '../types/workbench';
import { sampleStatus } from './sample-inspection';

export type InspectionFilter = 'ARRIVED' | 'PASSED';

export function matchesInspectionItem(item: SampleRequestItem, filter: InspectionFilter): boolean {
  return sampleStatus(item) === (filter === 'ARRIVED' ? 'RECEIVED' : 'PASSED');
}

/** Cards count requests: every line must pass, but any pending receipt needs attention. */
export function matchesInspectionRequest(items: readonly SampleRequestItem[], filter: InspectionFilter): boolean {
  if (!items.length) return false;
  return filter === 'PASSED'
    ? items.every((item) => matchesInspectionItem(item, filter))
    : items.some((item) => matchesInspectionItem(item, filter));
}

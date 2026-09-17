import type { SampleRequestItem } from '../types/workbench';

/** Project snapshots provide defaults, not replacements for tracker evidence. */
export function mergeProjectSampleItem(
  generated: SampleRequestItem,
  existing?: SampleRequestItem,
): SampleRequestItem {
  return {
    ...generated,
    ...existing,
    // An explicit project line note is editable; absent notes retain tracker notes.
    ...(generated.note !== undefined ? { note: generated.note } : {}),
  };
}

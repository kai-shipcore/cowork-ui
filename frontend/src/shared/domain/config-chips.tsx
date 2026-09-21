import type { JSX } from 'react';
import { MetadataChips } from '@coverland-engineering/ui/metadata-chips';

interface ConfigChipsProps {
  options: readonly (readonly [string, string])[];
}

/** Adapts vehicle configuration options to the shared metadata display. */
export function ConfigChips({ options }: ConfigChipsProps): JSX.Element {
  return (
    <MetadataChips
      label="Vehicle options"
      items={options.map(([name, value]) => ({
        id: `${name}-${value}`,
        label: name,
        value,
      }))}
    />
  );
}

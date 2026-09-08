interface ConfigChipsProps {
  options: ReadonlyArray<readonly [string, string]>;
}

/** Renders the option combination that identifies a vehicle configuration. */
export function ConfigChips({ options }: ConfigChipsProps) {
  return (
    <div className="config-chips">
      {options.map(([name, value]) => (
        <span className="config-chip" key={`${name}-${value}`}>
          {name} <strong>{value}</strong>
        </span>
      ))}
    </div>
  );
}

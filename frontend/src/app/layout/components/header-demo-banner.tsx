import { PEOPLE } from '@/modules/operations/operations-model';
import { useOperations } from '@/app/operations-store';
import { ResetMockDataButton } from './reset-mock-data-button';

/** Compact demo status with the demo actor selector and mock-data reset, shown in the header. */
export function HeaderDemoBanner() {
  const { actor, changeActor, message, saving } = useOperations();
  const status = saving ? 'Saving…' : message;

  return (
    <div className="ops-demo">
      <span>
        Public demo · Saved in this browser only
        {status && ` · ${status}`}
      </span>
      <div className="ops-demo-actions">
        <label>
          Demo ID
          <select
            aria-label="Select demo actor"
            value={actor.id}
            onChange={(event) => {
              changeActor(event.target.value);
            }}
          >
            {PEOPLE.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <ResetMockDataButton />
      </div>
    </div>
  );
}

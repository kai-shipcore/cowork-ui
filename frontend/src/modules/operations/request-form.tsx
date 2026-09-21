import { useState, type SyntheticEvent } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Input } from '@coverland-engineering/ui/input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useOperations } from '@/app/operations-store';
import { useWorkbenchStore } from '@/app/workbench-store';
import {
  PEOPLE,
  requestLink,
  TEAM_IDS,
  TEAM_NAMES,
  type TeamId,
} from './operations-model';
import {
  loadPersonalSettings,
  requestApprovalDefaults,
} from './personal-settings-model';

const TEMPLATES = [
  {
    title: 'CS → R&D Quality investigation',
    team: 'rd',
    category: 'Quality investigation',
    description:
      'Customer symptoms: Vehicle/product: Frequency: Investigation and response needed:',
  },
  {
    title: 'R&D → eCommerce Launch handoff',
    team: 'ecommerce',
    category: 'Launch handoff',
    description:
      'Completed development scope: Fitment vehicles: Product photos/approval documents: Target launch date:',
  },
  {
    title: 'Planning → R&D Development request',
    team: 'rd',
    category: 'Development request',
    description:
      'Demand evidence: Estimated quantity: Vehicle/product: Target launch date:',
  },
  {
    title: 'eCommerce → Planning Inventory allocation',
    team: 'demand-planning',
    category: 'Inventory allocation',
    description:
      'Sales channel: Promotion schedule: Expected sales: Required receipt date:',
  },
] as const;

export function RequestForm({ team }: { team: TeamId }) {
  const { actor, add, saving } = useOperations();
  const { projects, masterProducts } = useWorkbenchStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [personal] = useState(() => loadPersonalSettings(actor));
  const [targetTeam, setTargetTeam] = useState<TeamId>(
    personal.settings.targetTeam,
  );
  const approvalDefaults = requestApprovalDefaults(
    personal.settings,
    targetTeam,
  );
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General request');
  const [referenceId, setReferenceId] = useState(params.get('reference') ?? '');

  function formText(data: FormData, key: string): string {
    const value = data.get(key);
    return typeof value === 'string' ? value : '';
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const references = [
      ...projects.map((entry) => ({
        id: entry.id,
        label: entry.id + ' · ' + entry.vehicle,
        path: '/vehicle-projects?project=' + encodeURIComponent(entry.id),
      })),
      ...masterProducts.map((entry) => ({
        id: entry.id,
        label: entry.sku + ' · ' + entry.fNumber,
        path: '/products?product=' + encodeURIComponent(entry.id),
      })),
    ];
    const reference = references.find((entry) => entry.id === referenceId);
    const priority = form.get('priority');
    const id = await add({
      title: formText(form, 'title'),
      description,
      sourceTeam: actor.team,
      targetTeam,
      assigneeId: formText(form, 'assignee'),
      reviewerId: formText(form, 'reviewer'),
      dueDate: formText(form, 'due'),
      priority:
        priority === 'urgent' || priority === 'high' ? priority : 'normal',
      category,
      reference: reference?.label ?? formText(form, 'reference'),
      referencePath: reference?.path ?? '',
    });
    if (id) void navigate(requestLink(id, team));
  }

  return (
    <form
      className="ops-form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <h2>Cross-team work request</h2>
      {personal.error && <p role="alert">{personal.error}</p>}
      <p>
        Requesting team: {TEAM_NAMES[actor.team]} · The receiving assignee
        accepts the request and the designated reviewer approves completion.
      </p>
      <label>
        Request template
        <select
          defaultValue=""
          onChange={(event) => {
            const template = TEMPLATES.find(
              (entry) => entry.title === event.target.value,
            );
            if (template) {
              setTargetTeam(template.team);
              setCategory(template.category);
              setDescription(template.description);
            }
          }}
        >
          <option value="">Write your own</option>
          {TEMPLATES.map((template) => (
            <option key={template.title}>{template.title}</option>
          ))}
        </select>
      </label>
      <label>
        Title
        <Input name="title" required maxLength={160} />
      </label>
      <div className="ops-two">
        <label>
          Receiving team
          <select
            value={targetTeam}
            onChange={(event) => {
              const id = TEAM_IDS.find((entry) => entry === event.target.value);
              if (id) setTargetTeam(id);
            }}
          >
            {TEAM_IDS.map((id) => (
              <option key={id} value={id}>
                {TEAM_NAMES[id]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Work category
          <Input
            value={category}
            required
            maxLength={80}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          />
        </label>
        <label>
          Assignee
          <select
            key={'assignee-' + targetTeam}
            name="assignee"
            required
            defaultValue={approvalDefaults.assigneeId}
          >
            <option value="">Select assignee</option>
            {PEOPLE.filter(
              (person) =>
                person.team === targetTeam && person.role === 'member',
            ).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Completion reviewer
          <select
            key={'reviewer-' + targetTeam}
            name="reviewer"
            required
            defaultValue={approvalDefaults.reviewerId}
          >
            <option value="">Select approver</option>
            {PEOPLE.filter(
              (person) => person.team === targetTeam && person.role === 'lead',
            ).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Due date (Los Angeles)
          <Input name="due" type="date" required />
        </label>
        <label>
          Priority
          <select name="priority" defaultValue={personal.settings.priority}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>
      <label>
        Related project / SKU
        <select
          value={referenceId}
          onChange={(event) => {
            setReferenceId(event.target.value);
          }}
        >
          <option value="">Enter reference manually</option>
          <optgroup label="Project">
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.id} · {project.vehicle}
              </option>
            ))}
          </optgroup>
          <optgroup label="Product SKUs">
            {masterProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.sku} · {product.fNumber}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {!referenceId && (
        <label>
          Related SKU / Sample / CS case
          <Input name="reference" maxLength={300} placeholder="ID and name" />
        </label>
      )}
      <label>
        Request details
        <textarea
          required
          maxLength={2000}
          rows={6}
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </label>
      <p>
        Add related documents and attachment links after creating the request.
      </p>
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Create request'}
      </Button>
    </form>
  );
}

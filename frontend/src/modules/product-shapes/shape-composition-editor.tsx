import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Checkbox } from '@coverland-engineering/ui/checkbox';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { Input } from '@coverland-engineering/ui/input';
import type { VehicleProductShape } from '@/shared/types/workbench';
import { CURRENT_USER_ID } from '@/app/current-user';
import { useWorkbenchStore } from '@/app/workbench-store';
import { isSizeReviewCurrent } from './shape-model';

export function ShapeCompositionEditor({
  shape,
  onClose,
}: {
  shape: VehicleProductShape;
  onClose: () => void;
}) {
  const { projectDetails, projects, setVehicleProductShapes } =
    useWorkbenchStore();
  const snapshots = new Map(Object.entries(projectDetails));
  const sources = projects.flatMap((project) =>
    (snapshots.get(project.id)?.zones ?? [])
      .filter(
        (zone) =>
          zone.productShapeId === shape.id &&
          isSizeReviewCurrent(
            zone,
            projectDetails[project.id].designs,
            projectDetails[project.id].visits,
          ),
      )
      .map((zone) => ({ project, zone })),
  );
  const [sourceId, setSourceId] = useState(
    shape.composition?.sourceZoneId ?? sources.slice(0, 1).pop()?.zone.id ?? '',
  );
  const [blueprint, setBlueprint] = useState(
    shape.composition?.blueprintUrl ?? '',
  );
  const [parts, setParts] = useState(shape.composition?.parts ?? []);
  const columns: FlatDataGridColumn<(typeof parts)[number]>[] = [
    {
      id: 'name',
      header: 'Part Name',
      width: 210,
      sortValue: (part) => part.name,
      cell: (part) => <>{part.name}</>,
    },
    {
      id: 'revision',
      header: 'Revision',
      width: 180,
      sortValue: (part) => part.revisionNumber,
      cell: (part) => <>{part.revisionNumber}</>,
    },
    {
      id: 'quantity',
      header: 'Quantity',
      width: 180,
      sortValue: (part) => part.quantity,
      cell: (part) => <>{part.quantity}</>,
    },
  ];
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const source = sources.find(({ zone }) => zone.id === sourceId);
  const approvedParts = source
    ? projectDetails[source.project.id].designs
        .filter(
          (part) =>
            part.vehicleProjectId === source.zone.id &&
            part.status === 'ACTIVE',
        )
        .map((part) => {
          const revision = [...part.revisions]
            .sort((a, b) => b.revisionNumber - a.revisionNumber)
            .slice(0, 1)
            .pop();
          return {
            designId: part.id,
            partId: part.libraryPartId,
            name: part.name,
            revisionId: revision?.id ?? '',
            revisionNumber: revision?.revisionNumber ?? 0,
            quantity: part.quantity,
          };
        })
    : [];
  const validUrl = (() => {
    try {
      return ['http:', 'https:'].includes(new URL(blueprint.trim()).protocol);
    } catch {
      return false;
    }
  })();
  const matches =
    parts.length > 0 && JSON.stringify(parts) === JSON.stringify(approvedParts);
  const save = (complete: boolean) => {
    if (!source || (complete && (!matches || !validUrl || !confirmed))) return;
    setVehicleProductShapes((current) =>
      current.map((item) =>
        item.id === shape.id
          ? {
              ...item,
              updatedAt: new Date().toISOString(),
              composition: {
                sourceProjectId: source.project.id,
                sourceZoneId: source.zone.id,
                parts,
                blueprintUrl: blueprint.trim(),
                status: complete ? 'COMPLETE' : 'DRAFT',
                updatedAt: new Date().toISOString(),
                updatedBy: CURRENT_USER_ID,
              },
            }
          : item,
      ),
    );
    setMessage(complete ? 'Composition completed.' : 'Draft saved.');
  };
  return (
    <section className="shape-section shape-composition-editor">
      <h3>{shape.name} Composition</h3>
      <p>
        Owner: Pattern Designer. Register all approved part names, revisions,
        and quantities, then link a blueprint containing all pattern pieces on
        one sheet.
      </p>
      <div className="shape-composition-source">
        <label className="shape-composition-field">
          Approved source project
          <select
            aria-label="Composition source project"
            value={sourceId}
            onChange={(event) => {
              setSourceId(event.target.value);
              setParts([]);
              setConfirmed(false);
            }}
          >
            <option value="">Select project</option>
            {sources.map(({ project, zone }) => (
              <option key={zone.id} value={zone.id}>
                {project.vehicle} · {zone.code}
              </option>
            ))}
          </select>
        </label>
        <div className="shape-actions">
          <Button
            variant="outline"
            disabled={!source}
            onClick={() => {
              setParts(approvedParts);
              setConfirmed(false);
            }}
          >
            Import all approved parts
          </Button>
        </div>
      </div>
      {!sources.length && (
        <p className="shape-errors">
          A linked project with a valid review approval is required.
        </p>
      )}
      <div className="shape-composition-table-heading">
        <h4>Parts composition</h4>
        <span>{parts.length} Parts</span>
      </div>
      <div className="shape-table-scroll">
        <FlatDataGrid
          label="Parts composition"
          columns={columns}
          rows={parts}
          getRowId={(part) => part.designId}
          emptyMessage="Select the source project and import its approved parts."
        />
      </div>
      {!matches && (
        <p className="shape-errors">
          Import every part from the latest approved composition before
          completing.
        </p>
      )}
      <div className="shape-composition-blueprint">
        <label className="shape-composition-field">
          Complete blueprint image / Document link
          <Input
            value={blueprint}
            onChange={(event) => {
              setBlueprint(event.target.value);
              setConfirmed(false);
            }}
            placeholder="https://drive.google.com/..."
          />
        </label>
        {validUrl ? (
          <a href={blueprint.trim()} target="_blank" rel="noreferrer">
            Open and review blueprint ↗
          </a>
        ) : (
          <p>Enter a working HTTP or HTTPS link.</p>
        )}
      </div>
      <label className="shape-check">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(value) => {
            setConfirmed(value === true);
          }}
        />
        I verified that the full parts list matches the blueprint and the link
        opens. Once saved, projects using this Shape reference the same
        composition.
      </label>
      <div className="shape-actions shape-composition-footer">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="outline"
          disabled={!source}
          onClick={() => {
            save(false);
          }}
        >
          Save draft
        </Button>
        <Button
          variant="primary"
          disabled={!source || !matches || !validUrl || !confirmed}
          onClick={() => {
            save(true);
          }}
        >
          Composition complete
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

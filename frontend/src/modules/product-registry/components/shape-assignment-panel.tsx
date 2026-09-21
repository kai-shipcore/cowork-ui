import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { assignmentErrors } from '@/shared/domain/shape-assignment';
import type { ShapeAssignment } from '@/shared/types/db-workflow';
import { PRODUCT_TYPES, type UniqueVehicle } from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import '@/modules/product-shapes/shape-management.css';

export function ShapeAssignmentPanel({ vehicle }: { vehicle: UniqueVehicle }) {
  const {
    shapeAssignments,
    vehicleProductShapes,
    vehicleZones,
    updateWorkbench,
  } = useWorkbenchStore();
  const [zone, setZone] = useState('');
  const [shape, setShape] = useState('');
  const [type, setType] = useState<ShapeAssignment['type']>('PRIMARY');
  const [priority, setPriority] = useState('1');
  const [message, setMessage] = useState('');
  const productTypeId =
    vehicle.productTypeId ??
    PRODUCT_TYPES.find((row) => row.product === vehicle.product)?.id ??
    '';
  const vehicleId = vehicle.id ?? vehicle.fNumber;
  const rows = shapeAssignments.filter(
    (row) => row.uniqueVehicleId === vehicleId,
  );
  const save = () => {
    const input: ShapeAssignment = {
      id: crypto.randomUUID(),
      uniqueVehicleId: vehicleId,
      vehicleZoneId: zone,
      vehicleProductShapeId: shape,
      type,
      substitutionPriority:
        type === 'ALTERNATIVE' ? Number(priority) : undefined,
      validFrom: new Date().toISOString(),
    };
    const errors = assignmentErrors(
      input,
      productTypeId,
      vehicleProductShapes,
      vehicleZones,
      shapeAssignments,
    );
    if (errors.length) {
      setMessage(errors.join(' '));
      return;
    }
    updateWorkbench((state) =>
      assignmentErrors(
        input,
        productTypeId,
        state.vehicleProductShapes,
        state.vehicleZones,
        state.shapeAssignments,
      ).length
        ? state
        : { ...state, shapeAssignments: [...state.shapeAssignments, input] },
    );
    setMessage('Assignment history saved.');
  };
  return (
    <details className="shape-section">
      <summary>Sales vehicle Shape assignments · {vehicle.fNumber}</summary>
      <p>
        Separate from development project links. Legacy name lists are
        preserved; zones are not inferred or converted automatically.
      </p>
      <label>
        Zone{' '}
        <select
          value={zone}
          onChange={(e) => {
            setZone(e.target.value);
          }}
        >
          <option value="">Select</option>
          {vehicleZones
            .filter((row) => row.productTypeId === productTypeId)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Shape{' '}
        <select
          value={shape}
          onChange={(e) => {
            setShape(e.target.value);
          }}
        >
          <option value="">Select</option>
          {vehicleProductShapes
            .filter(
              (row) =>
                row.productTypeId === productTypeId && row.status === 'ACTIVE',
            )
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Assignment type{' '}
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as typeof type);
          }}
        >
          <option>PRIMARY</option>
          <option>ALTERNATIVE</option>
        </select>
      </label>
      {type === 'ALTERNATIVE' && (
        <label>
          Alternative priority{' '}
          <input
            type="number"
            min="1"
            step="1"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
            }}
          />
        </label>
      )}
      <Button onClick={save}>Add assignment</Button>
      {rows.map((row) => (
        <p key={row.id}>
          {vehicleZones.find((z) => z.id === row.vehicleZoneId)?.name} ·{' '}
          {
            vehicleProductShapes.find((s) => s.id === row.vehicleProductShapeId)
              ?.name
          }{' '}
          · {row.type} {row.substitutionPriority} · {row.validFrom} ~{' '}
          {row.validTo ?? 'Current'}{' '}
          {!row.validTo && (
            <Button
              variant="outline"
              onClick={() => {
                updateWorkbench((state) => ({
                  ...state,
                  shapeAssignments: state.shapeAssignments.map((item) =>
                    item.id === row.id && !item.validTo
                      ? { ...item, validTo: new Date().toISOString() }
                      : item,
                  ),
                }));
              }}
            >
              End assignment
            </Button>
          )}
        </p>
      ))}
      {!rows.length && <p>No confirmed assignments by zone.</p>}
      {message && <p role="status">{message}</p>}
    </details>
  );
}

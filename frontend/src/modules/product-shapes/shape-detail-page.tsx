import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import {
  ArrowLeft,
  Box,
  CalendarDays,
  ExternalLink,
  Pencil,
  Ruler,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { formatDateTime } from '@/shared/lib/helpers';
import { PageHeader } from '@/shared/components/page-header';
import { StatusBadge } from '@/shared/components/status-badge';
import {
  PRODUCT_TYPES,
  type VehicleProductShape,
} from '@/shared/types/workbench';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ShapeEditor } from './shape-editor';
import { SHAPE_STATUSES, shapeUsage } from './shape-model';
import './shape-management.css';

function statusTone(status: VehicleProductShape['status']) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'RETIRED') return 'neutral' as const;
  return 'progress' as const;
}

function dimensionValue(value: number | undefined, unit: 'CM' | 'IN') {
  return value === undefined ? '—' : `${value.toLocaleString()} ${unit}`;
}

export function ShapeDetailPage() {
  const { shapeId } = useParams();
  const {
    vehicleProductShapes: shapes,
    setVehicleProductShapes,
    projects,
  } = useWorkbenchStore();
  const [editing, setEditing] = useState(false);
  const shape = shapes.find((item) => item.id === shapeId);
  const backUrl = '/product-shapes?view=issued';

  if (!shape) {
    return (
      <section className="shape-management shape-detail-page">
        <Link className="shape-detail-back" to={backUrl}>
          <ArrowLeft size={16} />
          Back to Shape List
        </Link>
        <PageHeader description="Shape record unavailable." />
        <Card className="shape-detail-empty">
          <Box aria-hidden="true" />
          <h2>Shape not found</h2>
          <p>
            This Shape is not available in this browser. It may have been
            removed or created on another device.
          </p>
          <Link to={backUrl}>Return to Shape List</Link>
        </Card>
      </section>
    );
  }

  const product =
    PRODUCT_TYPES.find((item) => item.id === shape.productTypeId)?.product ??
    shape.productTypeId;
  const usage = shapeUsage(shape.id, projects);
  const dimensionsApplicable = shape.productTypeId === 'PT-CC';
  const dimensions = shape.dimensions;

  return (
    <section className="shape-management shape-detail-page">
      <Link className="shape-detail-back" to={backUrl}>
        <ArrowLeft size={16} />
        Back to Shape List
      </Link>
      <PageHeader
        description="Shape identity, finished-product dimensions, and linked development projects."
        tables={[
          { name: 'vehicle_product_shape' },
          { name: 'vehicle_product_shape_dimension' },
          { name: 'vehicle_project' },
        ]}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(true);
            }}
          >
            <Pencil size={16} />
            Edit Shape
          </Button>
        }
      />

      <Card className="shape-detail-hero">
        <div className="shape-detail-icon" aria-hidden="true">
          <Box />
        </div>
        <div className="shape-detail-title">
          <span>{product}</span>
          <h2>{shape.name}</h2>
          <code>{shape.id}</code>
        </div>
        <StatusBadge
          label={SHAPE_STATUSES[shape.status]}
          tone={statusTone(shape.status)}
        />
      </Card>

      <div className="shape-detail-layout">
        <Card className="shape-detail-card shape-dimension-card">
          <div className="shape-detail-section-heading">
            <div>
              <span className="shape-detail-eyebrow">SHAPE DIMENSION</span>
              <h2>Finished dimensions</h2>
            </div>
            <div className="shape-detail-section-icon" aria-hidden="true">
              <Ruler />
            </div>
          </div>

          {!dimensionsApplicable ? (
            <div className="shape-dimension-state">
              <strong>Dimensions do not apply to {product} Shapes.</strong>
              <p>
                The current schema stores Shape-level dimensions for Car Cover
                only. Seat Cover and Floor Mat dimensions are managed through
                their product-specific records.
              </p>
            </div>
          ) : dimensions ? (
            <>
              <div className="shape-dimension-summary">
                <span>UNIT</span>
                <strong>
                  {dimensions.unit === 'IN' ? 'Inches' : 'Centimeters'}
                </strong>
              </div>
              <dl className="shape-dimension-grid">
                <div>
                  <dt>Length</dt>
                  <dd>{dimensionValue(dimensions.length, dimensions.unit)}</dd>
                </div>
                <div>
                  <dt>Height</dt>
                  <dd>{dimensionValue(dimensions.height, dimensions.unit)}</dd>
                </div>
                <div>
                  <dt>Front width</dt>
                  <dd>
                    {dimensionValue(dimensions.frontWidth, dimensions.unit)}
                  </dd>
                </div>
                <div>
                  <dt>Rear width</dt>
                  <dd>
                    {dimensionValue(dimensions.backWidth, dimensions.unit)}
                  </dd>
                </div>
              </dl>
              <p className="shape-dimension-note">
                Front and rear widths are recorded together. Equal values mean
                the cover uses a symmetric cut.
              </p>
            </>
          ) : (
            <div className="shape-dimension-state missing">
              <strong>Dimensions not registered</strong>
              <p>
                Add length, height, and the optional front/rear width pair for
                this Car Cover Shape.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(true);
                }}
              >
                <Ruler size={16} />
                Add dimensions
              </Button>
            </div>
          )}
        </Card>

        <Card className="shape-detail-card">
          <div className="shape-detail-section-heading compact">
            <div>
              <span className="shape-detail-eyebrow">RECORD</span>
              <h2>Shape information</h2>
            </div>
          </div>
          <dl className="shape-record-grid">
            <div>
              <dt>Product type</dt>
              <dd>{product}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{SHAPE_STATUSES[shape.status]}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {shape.source === 'ADOPTED' ? 'Adopted' : 'New development'}
              </dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>{shape.createdBy}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(shape.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{shape.updatedAt ? formatDateTime(shape.updatedAt) : '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="shape-detail-card">
        <div className="shape-detail-section-heading compact">
          <div>
            <span className="shape-detail-eyebrow">USAGE</span>
            <h2>Linked projects</h2>
            <p>{usage.length} zone projects currently use this Shape.</p>
          </div>
          <CalendarDays aria-hidden="true" />
        </div>
        {usage.length ? (
          <div className="shape-project-list">
            {usage.map(({ project, zone }) => (
              <Link
                key={zone.id}
                to={`/vehicle-projects?project=${encodeURIComponent(project.id)}&zone=${encodeURIComponent(zone.code)}&tab=overview`}
              >
                <div>
                  <strong>{project.vehicle}</strong>
                  <span>
                    {zone.label} · {zone.code}
                  </span>
                </div>
                <div className="shape-project-stage">
                  <span>{zone.currentStage}</span>
                  <ExternalLink size={15} aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="shape-dimension-state">
            <strong>No linked projects</strong>
            <p>
              This Shape is available but is not assigned to a zone project.
            </p>
          </div>
        )}
      </Card>

      {editing && (
        <ShapeEditor
          shape={shape}
          shapes={shapes}
          usageCount={usage.length}
          onClose={() => {
            setEditing(false);
          }}
          onSave={(updated) => {
            setVehicleProductShapes((current) =>
              current.map((item) => (item.id === updated.id ? updated : item)),
            );
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}

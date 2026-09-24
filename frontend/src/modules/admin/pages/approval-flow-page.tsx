import { useState } from 'react';
import { Button } from '@coverland-engineering/ui/button';
import { Card } from '@coverland-engineering/ui/card';
import {
  FlatDataGrid,
  type FlatDataGridColumn,
} from '@coverland-engineering/ui/flat-data-grid';
import { SummaryCard } from '@coverland-engineering/ui/summary-card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@coverland-engineering/ui/tabs';
import {
  Ban,
  CircleCheck,
  CircleX,
  Clock3,
  GitPullRequest,
  Route,
  ShieldCheck,
  Tags,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  approvalEntityPath,
  approvalEntityTitle,
} from '@/shared/domain/approval/approval-actions';
import {
  requestProgress,
  userLabel,
} from '@/shared/domain/approval/approval-model';
import { ApprovalStatusChip } from '@/shared/domain/approval/approval-status-chip';
import { PageHeader } from '@/shared/components/page-header';
import { useSortedPage } from '@/shared/components/use-sorted-page';
import type { ApprovalRequest } from '@/shared/types/db-workflow';
import { useWorkbenchStore } from '@/app/workbench-store';
import { ApprovalAdministration } from '../approval-administration';
import { ApprovalRouteTemplateCard } from '../approval-route-template-card';
import { ApprovalTypesTab } from '../approval-types-tab';
import '../admin.css';
import '@/shared/domain/approval/approval.css';

const REQUEST_STATUSES = [
  {
    status: 'PENDING',
    label: 'Pending requests',
    tone: 'warning',
    icon: Clock3,
  },
  {
    status: 'APPROVED',
    label: 'Approved requests',
    tone: 'success',
    icon: CircleCheck,
  },
  {
    status: 'REJECTED',
    label: 'Rejected requests',
    tone: 'danger',
    icon: CircleX,
  },
  {
    status: 'CANCELLED',
    label: 'Cancelled requests',
    tone: 'neutral',
    icon: Ban,
  },
] as const;

/** Approval flow management: types, grants, and every request in flight. */
export function ApprovalFlowPage() {
  const navigate = useNavigate();
  const state = useWorkbenchStore();
  const {
    approvalRequests,
    approvalSteps,
    approvalAssignments,
    appUsers,
    approvalTypes,
  } = state;
  const [typeId, setTypeId] = useState(approvalTypes[0]?.id ?? '');
  const [tab, setTab] = useState('types');
  const [requestQuery, setRequestQuery] = useState('');
  const pending = approvalRequests
    .filter((request) => request.status === 'PENDING')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const requestColumns: FlatDataGridColumn<ApprovalRequest>[] = [
    {
      id: 'request',
      header: 'Request',
      width: 320,
      sortValue: (request) => approvalEntityTitle(state, request),
      cell: (request) => (
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {approvalEntityTitle(state, request)}
          </div>
          {request.note && (
            <div className="text-xs text-muted-foreground">
              “{request.note}”
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'requestedBy',
      header: 'Requested by',
      width: 200,
      sortValue: (request) => userLabel(appUsers, request.requestedBy),
      cell: (request) => (
        <div className="min-w-0">
          <div className="text-sm">
            {userLabel(appUsers, request.requestedBy)}
          </div>
          <div className="text-xs text-muted-foreground">
            {request.createdAt.slice(0, 10)}
          </div>
        </div>
      ),
    },
    {
      id: 'progress',
      header: 'Progress',
      width: 260,
      sortValue: (request) =>
        requestProgress(request, approvalSteps, approvalAssignments, appUsers)
          .label,
      cell: (request) => {
        const progress = requestProgress(
          request,
          approvalSteps,
          approvalAssignments,
          appUsers,
        );
        return (
          <ApprovalStatusChip
            status={request.status}
            detail={[progress.label, progress.detail]
              .filter(Boolean)
              .join(' · ')}
          />
        );
      },
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      label: 'Actions',
      width: 100,
      hideable: false,
      cell: (request) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // React Router handles route errors; the click does not await navigation.
            void navigate(approvalEntityPath(request));
          }}
        >
          Open
        </Button>
      ),
    },
  ];
  const requestNeedle = requestQuery.trim().toLowerCase();
  const visiblePending = pending.filter(
    (request) =>
      !requestNeedle ||
      `${approvalEntityTitle(state, request)} ${userLabel(appUsers, request.requestedBy)} ${request.note ?? ''}`
        .toLowerCase()
        .includes(requestNeedle),
  );
  const requestPage = useSortedPage(
    visiblePending,
    requestColumns,
    requestQuery,
  );

  return (
    <section className="admin-page">
      <PageHeader
        description="Select one approval type, then manage its user grants or default approval steps from the tabs below"
        tables={
          import.meta.env.DEV
            ? [
                { name: 'approval_type' },
                { name: 'user_x_approval_type_grant' },
                { name: 'approval_request' },
                { name: 'approval_request_step' },
                { name: 'approval_request_step_assignment' },
              ]
            : undefined
        }
      />
      <Card>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="grid-tabs-list">
            <TabsTrigger value="types">
              <Tags aria-hidden="true" /> Approval types
            </TabsTrigger>
            <TabsTrigger value="grants">
              <ShieldCheck aria-hidden="true" /> User grants
            </TabsTrigger>
            <TabsTrigger value="steps">
              <Route aria-hidden="true" /> Approval steps
            </TabsTrigger>
            <TabsTrigger value="requests">
              <GitPullRequest aria-hidden="true" /> Requests in flight
              {pending.length > 0 && (
                <span className="stage-tab-count">{pending.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
          {(tab === 'grants' || tab === 'steps') && (
            <div className="admin-type-selector admin-type-selector--in-tabs">
              <span className="admin-type-selector__label">Approval type</span>
              <select
                aria-label="Approval type"
                value={
                  approvalTypes.find((type) => type.id === typeId)?.code ?? ''
                }
                onChange={(event) => {
                  const selected = approvalTypes.find(
                    (type) => type.code === event.target.value,
                  );
                  setTypeId(selected?.id ?? '');
                }}
              >
                {approvalTypes.map((type) => (
                  <option key={type.id} value={type.code}>
                    {type.name}
                  </option>
                ))}
              </select>
              <p>
                Select the approval type whose{' '}
                {tab === 'grants' ? 'user permissions' : 'default steps'} you
                want to configure.
              </p>
            </div>
          )}
          <TabsContent value="types" className="admin-approval-tab">
            <ApprovalTypesTab
              selectedTypeId={typeId}
              onSelectedTypeChange={setTypeId}
            />
          </TabsContent>
          <TabsContent value="grants" className="admin-approval-tab">
            <ApprovalAdministration key={typeId} approvalTypeId={typeId} />
          </TabsContent>
          <TabsContent value="steps" className="admin-approval-tab">
            {typeId && (
              <ApprovalRouteTemplateCard key={typeId} approvalTypeId={typeId} />
            )}
          </TabsContent>
          <TabsContent value="requests" className="admin-approval-tab">
            <div className="admin-tab-panel">
              <div className="admin-stats">
                {REQUEST_STATUSES.map(({ status, label, tone, icon: Icon }) => (
                  <SummaryCard
                    key={status}
                    label={label}
                    value={
                      approvalRequests.filter(
                        (request) => request.status === status,
                      ).length
                    }
                    icon={<Icon />}
                    tone={tone}
                  />
                ))}
              </div>
              <FlatDataGrid
                embedded
                label="Requests in flight"
                columns={requestColumns}
                rows={requestPage.pageItems}
                getRowId={(request) => request.id}
                emptyMessage={
                  pending.length
                    ? 'No requests match this search.'
                    : 'No requests are waiting for a decision.'
                }
                search={{
                  label: 'Search requests',
                  placeholder: 'Search request, requester or note',
                  value: requestQuery,
                  onChange: setRequestQuery,
                }}
                toolbarContent={
                  requestQuery !== '' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRequestQuery('');
                      }}
                    >
                      <X /> Clear filters
                    </Button>
                  )
                }
                pagination={requestPage.pagination}
                sorting={requestPage.sorting}
              />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </section>
  );
}

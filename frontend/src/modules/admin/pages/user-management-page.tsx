import { Card } from '@coverland-engineering/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@coverland-engineering/ui/tabs';
import { Building2, KeyRound, Shield, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/components/page-header';
import { DepartmentsTab } from '../components/departments-tab';
import { PermissionsTab } from '../components/permissions-tab';
import { RolesTab } from '../components/roles-tab';
import { UsersTab } from '../components/users-tab';
import {
  useListAppRolesQuery,
  useListDepartmentsQuery,
  useListPermissionsQuery,
  useListUsersQuery,
} from '../users-api';
import '../admin.css';

const TABS = ['users', 'departments', 'roles', 'permissions'] as const;
type Tab = (typeof TABS)[number];

function isTab(value: string): value is Tab {
  return (TABS as readonly string[]).includes(value);
}

/** Users, departments, roles and permissions of the workspace. */
export function UserManagementPage() {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') ?? 'users';
  const tab: Tab = isTab(requestedTab) ? requestedTab : 'users';
  const users = useListUsersQuery();
  const departments = useListDepartmentsQuery();
  const roles = useListAppRolesQuery();
  const permissions = useListPermissionsQuery();

  function selectTab(value: string): void {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', value);
      return next;
    });
  }

  return (
    <section className="admin-user-management">
      <PageHeader
        description="Who can sign in, which roles they hold, and who has been invited. Roles decide permissions; approval grants are managed under Approval Flow Management."
        tables={
          import.meta.env.DEV
            ? [
                { name: 'app_user' },
                { name: 'department' },
                { name: 'app_role' },
                { name: 'user_invitation' },
                { name: 'permission' },
                { name: 'role_x_permission' },
                { name: 'user_x_permission_assignment' },
                { name: 'user_x_approval_type_grant' },
              ]
            : undefined
        }
      />

      <Card>
        <Tabs value={tab} onValueChange={selectTab}>
          <TabsList variant="line" className="grid-tabs-list">
            <TabsTrigger value="users">
              <Users aria-hidden="true" />
              Users
              {users.data && (
                <span className="stage-tab-count">{users.data.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="departments">
              <Building2 aria-hidden="true" />
              Departments
              {departments.data && (
                <span className="stage-tab-count">
                  {departments.data.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="roles">
              <Shield aria-hidden="true" />
              Roles
              {roles.data && (
                <span className="stage-tab-count">{roles.data.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="permissions">
              <KeyRound aria-hidden="true" />
              Permissions
              {permissions.data && (
                <span className="stage-tab-count">
                  {permissions.data.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="admin-approval-tab">
            <UsersTab />
          </TabsContent>
          <TabsContent value="departments" className="admin-approval-tab">
            <DepartmentsTab />
          </TabsContent>
          <TabsContent value="roles" className="admin-approval-tab">
            <RolesTab />
          </TabsContent>
          <TabsContent value="permissions" className="admin-approval-tab">
            <PermissionsTab />
          </TabsContent>
        </Tabs>
      </Card>
    </section>
  );
}

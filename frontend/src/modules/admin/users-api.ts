/* eslint-disable @typescript-eslint/no-invalid-void-type -- RTK Query uses `void` as the argument type of endpoints whose hooks are called without an argument; `undefined` would force every call site to pass one. */

import { api } from '@/services/api';
import type {
  AppRoleDto,
  AppRoleInput,
  AppUserDto,
  AppUserInput,
  DepartmentDto,
  DepartmentInput,
  InvitationDto,
  InvitationInput,
  InviteUserInput,
  PermissionAssignmentDto,
  PermissionAssignmentInput,
  PermissionDto,
  PermissionInput,
  RolePermissionDto,
} from './app-user-dto';
import {
  AdminStoreError,
  createAdminStore,
  type AdminStore,
} from './local-admin-store';

const USERS_TAG = 'Users';
const DEPARTMENTS_TAG = 'Departments';
const APP_ROLES_TAG = 'AppRoles';
const INVITATIONS_TAG = 'Invitations';
const PERMISSIONS_TAG = 'Permissions';
const ROLE_PERMISSIONS_TAG = 'RolePermissions';
const ASSIGNMENTS_TAG = 'PermissionAssignments';

let store: AdminStore | undefined;

/** The browser's localStorage is the data source for the whole admin area. */
function adminStore(): AdminStore {
  store ??= createAdminStore(window.localStorage);
  return store;
}

/** Runs one store operation and shapes failures the way `apiErrorMessage` reads them. */
function local<T>(run: (store: AdminStore) => T) {
  try {
    return { data: run(adminStore()) };
  } catch (error) {
    if (error instanceof AdminStoreError) {
      return {
        error: { status: error.status, data: { message: error.message } },
      };
    }
    return {
      error: {
        status: 500,
        data: {
          message:
            'Unable to read saved data. Existing records have not been overwritten.',
        },
      },
    };
  }
}

export const usersApi = api
  .enhanceEndpoints({
    addTagTypes: [
      USERS_TAG,
      DEPARTMENTS_TAG,
      APP_ROLES_TAG,
      INVITATIONS_TAG,
      PERMISSIONS_TAG,
      ROLE_PERMISSIONS_TAG,
      ASSIGNMENTS_TAG,
    ],
  })
  .injectEndpoints({
    endpoints: (build) => ({
      listUsers: build.query<AppUserDto[], void>({
        queryFn: () => local((store) => store.listUsers()),
        providesTags: [USERS_TAG],
      }),
      createUser: build.mutation<AppUserDto, AppUserInput>({
        queryFn: (input) => local((store) => store.createUser(input)),
        invalidatesTags: [USERS_TAG],
      }),
      updateUser: build.mutation<
        AppUserDto,
        { id: string; input: AppUserInput }
      >({
        queryFn: ({ id, input }) =>
          local((store) => store.updateUser(id, input)),
        invalidatesTags: [USERS_TAG],
      }),
      listDepartments: build.query<DepartmentDto[], void>({
        queryFn: () => local((store) => store.listDepartments()),
        providesTags: [DEPARTMENTS_TAG],
      }),
      createDepartment: build.mutation<DepartmentDto, DepartmentInput>({
        queryFn: (input) => local((store) => store.createDepartment(input)),
        invalidatesTags: [DEPARTMENTS_TAG],
      }),
      updateDepartment: build.mutation<
        DepartmentDto,
        { id: string; input: DepartmentInput }
      >({
        queryFn: ({ id, input }) =>
          local((store) => store.updateDepartment(id, input)),
        invalidatesTags: [DEPARTMENTS_TAG, USERS_TAG, APP_ROLES_TAG],
      }),
      deleteDepartment: build.mutation<null, string>({
        queryFn: (id) =>
          local((store) => {
            store.deleteDepartment(id);
            return null;
          }),
        invalidatesTags: [DEPARTMENTS_TAG],
      }),
      listAppRoles: build.query<AppRoleDto[], void>({
        queryFn: () => local((store) => store.listRoles()),
        providesTags: [APP_ROLES_TAG],
      }),
      createAppRole: build.mutation<AppRoleDto, AppRoleInput>({
        queryFn: (input) => local((store) => store.createRole(input)),
        invalidatesTags: [APP_ROLES_TAG],
      }),
      // A renamed role changes the role name shown on every user, so both lists refetch.
      updateAppRole: build.mutation<
        AppRoleDto,
        { id: string; input: AppRoleInput }
      >({
        queryFn: ({ id, input }) =>
          local((store) => store.updateRole(id, input)),
        invalidatesTags: [APP_ROLES_TAG, USERS_TAG],
      }),
      deleteAppRole: build.mutation<null, string>({
        queryFn: (id) =>
          local((store) => {
            store.deleteRole(id);
            return null;
          }),
        invalidatesTags: [APP_ROLES_TAG, ROLE_PERMISSIONS_TAG],
      }),
      inviteUser: build.mutation<AppUserDto, InviteUserInput>({
        queryFn: (input) => local((store) => store.inviteUser(input)),
        invalidatesTags: [USERS_TAG, INVITATIONS_TAG],
      }),
      sendInvitation: build.mutation<InvitationDto, InvitationInput>({
        queryFn: (input) => local((store) => store.sendInvitation(input)),
        invalidatesTags: [INVITATIONS_TAG],
      }),
      revokeInvitation: build.mutation<void, string>({
        query: (userId) => ({
          url: `/api/v1/auth/users/${encodeURIComponent(userId)}/invitation/revoke`,
          method: 'POST',
        }),
        invalidatesTags: [USERS_TAG, INVITATIONS_TAG],
      }),
      listPermissions: build.query<PermissionDto[], void>({
        queryFn: () => local((store) => store.listPermissions()),
        providesTags: [PERMISSIONS_TAG],
      }),
      createPermission: build.mutation<PermissionDto, PermissionInput>({
        queryFn: (input) => local((store) => store.createPermission(input)),
        invalidatesTags: [PERMISSIONS_TAG],
      }),
      updatePermission: build.mutation<
        PermissionDto,
        { id: string; input: PermissionInput }
      >({
        queryFn: ({ id, input }) =>
          local((store) => store.updatePermission(id, input)),
        invalidatesTags: [PERMISSIONS_TAG, ASSIGNMENTS_TAG],
      }),
      // Links cascade, so both link lists refetch.
      deletePermission: build.mutation<null, string>({
        queryFn: (id) =>
          local((store) => {
            store.deletePermission(id);
            return null;
          }),
        invalidatesTags: [
          PERMISSIONS_TAG,
          ROLE_PERMISSIONS_TAG,
          ASSIGNMENTS_TAG,
        ],
      }),
      listRolePermissions: build.query<RolePermissionDto[], void>({
        queryFn: () => local((store) => store.listRolePermissions()),
        providesTags: [ROLE_PERMISSIONS_TAG],
      }),
      setRolePermissions: build.mutation<
        null,
        { appRoleId: string; permissionIds: string[] }
      >({
        queryFn: ({ appRoleId, permissionIds }) =>
          local((store) => {
            store.setRolePermissions(appRoleId, permissionIds);
            return null;
          }),
        invalidatesTags: [ROLE_PERMISSIONS_TAG],
      }),
      listPermissionAssignments: build.query<PermissionAssignmentDto[], void>({
        queryFn: () => local((store) => store.listAssignments()),
        providesTags: [ASSIGNMENTS_TAG],
      }),
      createPermissionAssignment: build.mutation<
        PermissionAssignmentDto,
        PermissionAssignmentInput
      >({
        queryFn: (input) => local((store) => store.createAssignment(input)),
        invalidatesTags: [ASSIGNMENTS_TAG],
      }),
      deletePermissionAssignment: build.mutation<null, string>({
        queryFn: (id) =>
          local((store) => {
            store.deleteAssignment(id);
            return null;
          }),
        invalidatesTags: [ASSIGNMENTS_TAG],
      }),
    }),
  });

export const {
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useListDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useListAppRolesQuery,
  useCreateAppRoleMutation,
  useUpdateAppRoleMutation,
  useDeleteAppRoleMutation,
  useInviteUserMutation,
  useSendInvitationMutation,
  useRevokeInvitationMutation,
  useListPermissionsQuery,
  useCreatePermissionMutation,
  useUpdatePermissionMutation,
  useDeletePermissionMutation,
  useListRolePermissionsQuery,
  useSetRolePermissionsMutation,
  useListPermissionAssignmentsQuery,
  useCreatePermissionAssignmentMutation,
  useDeletePermissionAssignmentMutation,
} = usersApi;

/** The `message` a failed operation carries, or a generic fallback. */
export function apiErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof error.data === 'object' &&
    error.data !== null &&
    'message' in error.data &&
    typeof error.data.message === 'string'
  ) {
    return error.data.message;
  }
  return 'The request failed. Please try again.';
}

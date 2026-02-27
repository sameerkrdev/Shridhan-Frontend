import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  assignRoleToMember,
  createPermission,
  createRole,
  deletePermission,
  deleteRole,
  fetchMembersWithRoles,
  fetchPermissions,
  fetchRoles,
  mapRolePermissions,
  removeRoleFromMember,
  updatePermission,
  updateRole,
} from "@/lib/accessControlApi"
import type {
  SocietyMemberWithRoles,
  SocietyPermission,
  SocietyRole,
} from "@/types/accessControl"

export const accessControlQueryKeys = {
  permissions: ["access-control", "permissions"],
  roles: ["access-control", "roles"],
  memberRoles: ["access-control", "member-roles"],
} as const

export const usePermissionsQuery = () => {
  return useQuery({
    queryKey: accessControlQueryKeys.permissions,
    queryFn: fetchPermissions,
  })
}

export const useRolesQuery = () => {
  return useQuery({
    queryKey: accessControlQueryKeys.roles,
    queryFn: fetchRoles,
  })
}

export const useMemberRolesQuery = () => {
  return useQuery({
    queryKey: accessControlQueryKeys.memberRoles,
    queryFn: fetchMembersWithRoles,
  })
}

export const useCreatePermissionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPermission,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.permissions })
    },
  })
}

export const useUpdatePermissionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ permissionId, payload }: { permissionId: string; payload: { name: string; description?: string } }) =>
      updatePermission(permissionId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.permissions })
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.roles })
    },
  })
}

export const useDeletePermissionMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deletePermission,
    onMutate: async (permissionId) => {
      await queryClient.cancelQueries({ queryKey: accessControlQueryKeys.permissions })
      const previousPermissions = queryClient.getQueryData<SocietyPermission[]>(
        accessControlQueryKeys.permissions
      )

      if (previousPermissions) {
        queryClient.setQueryData<SocietyPermission[]>(
          accessControlQueryKeys.permissions,
          previousPermissions.filter((permission) => permission.id !== permissionId)
        )
      }

      return { previousPermissions }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousPermissions) {
        queryClient.setQueryData(accessControlQueryKeys.permissions, context.previousPermissions)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.permissions })
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.roles })
    },
  })
}

export const useCreateRoleMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.roles })
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.memberRoles })
    },
  })
}

export const useUpdateRoleMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      roleId,
      payload,
    }: {
      roleId: string
      payload: { name?: string; description?: string; permissionIds?: string[] }
    }) => updateRole(roleId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.roles })
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.memberRoles })
    },
  })
}

export const useDeleteRoleMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteRole,
    onMutate: async (roleId) => {
      await queryClient.cancelQueries({ queryKey: accessControlQueryKeys.roles })
      const previousRoles = queryClient.getQueryData<SocietyRole[]>(accessControlQueryKeys.roles)

      if (previousRoles) {
        queryClient.setQueryData<SocietyRole[]>(
          accessControlQueryKeys.roles,
          previousRoles.filter((role) => role.id !== roleId)
        )
      }

      return { previousRoles }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousRoles) {
        queryClient.setQueryData(accessControlQueryKeys.roles, context.previousRoles)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.roles })
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.memberRoles })
    },
  })
}

export const useMapRolePermissionsMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      mapRolePermissions(roleId, permissionIds),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.roles })
    },
  })
}

export const useAssignRoleToMemberMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: assignRoleToMember,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.memberRoles })
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.roles })
    },
  })
}

export const useRemoveRoleFromMemberMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeRoleFromMember,
    onMutate: async ({ memberId, roleId }) => {
      await queryClient.cancelQueries({ queryKey: accessControlQueryKeys.memberRoles })
      const previousMembers = queryClient.getQueryData<SocietyMemberWithRoles[]>(
        accessControlQueryKeys.memberRoles
      )

      if (previousMembers) {
        queryClient.setQueryData<SocietyMemberWithRoles[]>(
          accessControlQueryKeys.memberRoles,
          previousMembers.map((member) =>
            member.id === memberId
              ? {
                  ...member,
                  assignedRoles: member.assignedRoles.filter((role) => role.roleId !== roleId),
                }
              : member
          )
        )
      }

      return { previousMembers }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(accessControlQueryKeys.memberRoles, context.previousMembers)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.memberRoles })
      void queryClient.invalidateQueries({ queryKey: accessControlQueryKeys.roles })
    },
  })
}

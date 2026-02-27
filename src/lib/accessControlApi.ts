import { apiClient } from "@/lib/apiClient"
import type {
  SocietyMemberWithRoles,
  SocietyPermission,
  SocietyRole,
} from "@/types/accessControl"

interface PermissionPayload {
  name: string
  description?: string
}

interface RolePayload {
  name: string
  description?: string
  permissionIds: string[]
}

export const fetchPermissions = async () => {
  const { data } = await apiClient.get<{ permissions: SocietyPermission[] }>(
    "/access-control/permissions"
  )
  return data.permissions
}

export const createPermission = async (payload: PermissionPayload) => {
  const { data } = await apiClient.post<{ permission: SocietyPermission }>(
    "/access-control/permissions",
    payload
  )
  return data.permission
}

export const updatePermission = async (permissionId: string, payload: PermissionPayload) => {
  const { data } = await apiClient.patch<{ permission: SocietyPermission }>(
    `/access-control/permissions/${permissionId}`,
    payload
  )
  return data.permission
}

export const deletePermission = async (permissionId: string) => {
  await apiClient.delete(`/access-control/permissions/${permissionId}`)
}

export const fetchRoles = async () => {
  const { data } = await apiClient.get<{ roles: SocietyRole[] }>("/access-control/roles")
  return data.roles
}

export const createRole = async (payload: RolePayload) => {
  const { data } = await apiClient.post<{ role: SocietyRole }>("/access-control/roles", payload)
  return data.role
}

export const updateRole = async (
  roleId: string,
  payload: { name?: string; description?: string; permissionIds?: string[] }
) => {
  const { data } = await apiClient.patch<{ role: SocietyRole }>(`/access-control/roles/${roleId}`, payload)
  return data.role
}

export const deleteRole = async (roleId: string) => {
  await apiClient.delete(`/access-control/roles/${roleId}`)
}

export const mapRolePermissions = async (roleId: string, permissionIds: string[]) => {
  await apiClient.put(`/access-control/roles/${roleId}/permissions`, { permissionIds })
}

export const fetchMembersWithRoles = async () => {
  const { data } = await apiClient.get<{ members: SocietyMemberWithRoles[] }>(
    "/access-control/member-roles"
  )
  return data.members
}

export const assignRoleToMember = async (payload: { memberId: string; roleId: string }) => {
  const { data } = await apiClient.post<{ assignment: { id: string } }>(
    "/access-control/member-roles",
    payload
  )
  return data.assignment
}

export const removeRoleFromMember = async (payload: { memberId: string; roleId: string }) => {
  await apiClient.delete("/access-control/member-roles", {
    data: payload,
  })
}

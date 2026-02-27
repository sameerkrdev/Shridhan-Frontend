import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/lib/apiError"
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useMapRolePermissionsMutation,
  usePermissionsQuery,
  useRolesQuery,
  useUpdateRoleMutation,
} from "@/hooks/useAccessControlApi"

const RolesManagementPage = () => {
  const [search, setSearch] = useState("")
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [draftRolePermissions, setDraftRolePermissions] = useState<Record<string, string[]>>({})

  const { data: roles = [], isLoading: isRolesLoading } = useRolesQuery()
  const { data: permissions = [], isLoading: isPermissionsLoading } = usePermissionsQuery()
  const createRoleMutation = useCreateRoleMutation()
  const updateRoleMutation = useUpdateRoleMutation()
  const deleteRoleMutation = useDeleteRoleMutation()
  const mapRolePermissionsMutation = useMapRolePermissionsMutation()

  const filteredRoles = useMemo(
    () =>
      roles.filter((role) => {
        const lookup = `${role.name} ${role.description ?? ""}`.toLowerCase()
        return lookup.includes(search.toLowerCase())
      }),
    [roles, search]
  )

  const resetRoleForm = () => {
    setRoleName("")
    setRoleDescription("")
    setEditingRoleId(null)
  }

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      toast.error("Role name is required")
      return
    }

    try {
      if (editingRoleId) {
        await updateRoleMutation.mutateAsync({
          roleId: editingRoleId,
          payload: {
            name: roleName.trim(),
            description: roleDescription.trim() || undefined,
          },
        })
        toast.success("Role updated")
      } else {
        await createRoleMutation.mutateAsync({
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
          permissionIds: [],
        })
        toast.success("Role created")
      }
      resetRoleForm()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save role"))
    }
  }

  const handleDeleteRole = async (roleId: string, roleNameValue: string) => {
    if (!window.confirm(`Delete role '${roleNameValue}'?`)) {
      return
    }

    try {
      await deleteRoleMutation.mutateAsync(roleId)
      toast.success("Role deleted")
      if (editingRoleId === roleId) {
        resetRoleForm()
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete role"))
    }
  }

  const handleStartEdit = (role: { id: string; name: string; description: string | null }) => {
    setEditingRoleId(role.id)
    setRoleName(role.name)
    setRoleDescription(role.description ?? "")
  }

  const getCheckedPermissions = (roleId: string, fallbackPermissionIds: string[]) => {
    return draftRolePermissions[roleId] ?? fallbackPermissionIds
  }

  const handleToggleRolePermission = (roleId: string, permissionId: string, checked: boolean) => {
    const role = roles.find((item) => item.id === roleId)
    if (!role) {
      return
    }

    const current = getCheckedPermissions(
      roleId,
      role.permissions.map((item) => item.permission.id)
    )
    const next = checked
      ? [...current, permissionId]
      : current.filter((currentPermissionId) => currentPermissionId !== permissionId)

    setDraftRolePermissions((previous) => ({
      ...previous,
      [roleId]: Array.from(new Set(next)),
    }))
  }

  const handleSaveRolePermissions = async (roleId: string) => {
    const role = roles.find((item) => item.id === roleId)
    if (!role) {
      return
    }

    const permissionIds = getCheckedPermissions(
      roleId,
      role.permissions.map((item) => item.permission.id)
    )

    try {
      await mapRolePermissionsMutation.mutateAsync({
        roleId,
        permissionIds,
      })
      toast.success("Role permissions updated")
      setDraftRolePermissions((previous) => {
        const next = { ...previous }
        delete next[roleId]
        return next
      })
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to update role permissions"))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Role Management</h1>
        <p className="text-muted-foreground mt-2">
          Create custom roles and map each role to permission toggles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingRoleId ? "Update Role" : "Create Role"}</CardTitle>
          <CardDescription>Create role names in snake_case for consistency.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Role name (example: operations_manager)"
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
          />
          <Input
            placeholder="Role description (optional)"
            value={roleDescription}
            onChange={(event) => setRoleDescription(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSaveRole}
              disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
            >
              {editingRoleId ? "Update Role" : "Create Role"}
            </Button>
            {editingRoleId ? (
              <Button variant="outline" onClick={resetRoleForm}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles and Permissions</CardTitle>
          <CardDescription>Search role names and update permission mapping.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {isRolesLoading || isPermissionsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRoles.map((role) => {
                const defaultPermissionIds = role.permissions.map((item) => item.permission.id)
                const checkedPermissionIds = getCheckedPermissions(role.id, defaultPermissionIds)
                const hasDraftChanges =
                  draftRolePermissions[role.id] !== undefined &&
                  JSON.stringify([...checkedPermissionIds].sort()) !==
                    JSON.stringify([...defaultPermissionIds].sort())

                return (
                  <div key={role.id} className="border rounded-md p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{role.name}</h3>
                          {role.isSystem ? <Badge variant="secondary">System</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {role.description || "No description"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(role)}
                          disabled={role.isSystem}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id, role.name)}
                          disabled={role.isSystem || deleteRoleMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {permissions.map((permission) => {
                        const checked = checkedPermissionIds.includes(permission.id)
                        return (
                          <label
                            key={`${role.id}-${permission.id}`}
                            className="border rounded-md px-3 py-2 flex items-center justify-between gap-2"
                          >
                            <span className="text-sm">{permission.name}</span>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                handleToggleRolePermission(role.id, permission.id, Boolean(value))
                              }
                              disabled={role.isSystem}
                            />
                          </label>
                        )
                      })}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSaveRolePermissions(role.id)}
                        disabled={!hasDraftChanges || role.isSystem || mapRolePermissionsMutation.isPending}
                      >
                        Save Permission Mapping
                      </Button>
                    </div>
                  </div>
                )
              })}

              {!filteredRoles.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No roles found.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default RolesManagementPage

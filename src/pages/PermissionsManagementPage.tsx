import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/lib/apiError"
import {
  useCreatePermissionMutation,
  useDeletePermissionMutation,
  usePermissionsQuery,
  useUpdatePermissionMutation,
} from "@/hooks/useAccessControlApi"

const PermissionsManagementPage = () => {
  const [search, setSearch] = useState("")
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [editingPermissionId, setEditingPermissionId] = useState<string | null>(null)

  const { data: permissions = [], isLoading } = usePermissionsQuery()
  const createPermissionMutation = useCreatePermissionMutation()
  const updatePermissionMutation = useUpdatePermissionMutation()
  const deletePermissionMutation = useDeletePermissionMutation()

  const filteredPermissions = useMemo(
    () =>
      permissions.filter((permission) => {
        const lookup = `${permission.name} ${permission.description ?? ""}`.toLowerCase()
        return lookup.includes(search.toLowerCase())
      }),
    [permissions, search]
  )

  const resetForm = () => {
    setFormName("")
    setFormDescription("")
    setEditingPermissionId(null)
  }

  const handleSavePermission = async () => {
    if (!formName.trim()) {
      toast.error("Permission name is required")
      return
    }

    try {
      if (editingPermissionId) {
        await updatePermissionMutation.mutateAsync({
          permissionId: editingPermissionId,
          payload: {
            name: formName.trim(),
            description: formDescription.trim() || undefined,
          },
        })
        toast.success("Permission updated")
      } else {
        await createPermissionMutation.mutateAsync({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
        })
        toast.success("Permission created")
      }
      resetForm()
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save permission"))
    }
  }

  const handleEdit = (permission: {
    id: string
    name: string
    description: string | null
  }) => {
    setEditingPermissionId(permission.id)
    setFormName(permission.name)
    setFormDescription(permission.description ?? "")
  }

  const handleDelete = async (permissionId: string) => {
    const confirmed = window.confirm("Delete this permission?")
    if (!confirmed) {
      return
    }

    try {
      await deletePermissionMutation.mutateAsync(permissionId)
      toast.success("Permission deleted")
      if (editingPermissionId === permissionId) {
        resetForm()
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete permission"))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Permission Management</h1>
        <p className="text-muted-foreground mt-2">Create and maintain society-specific permissions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingPermissionId ? "Update Permission" : "Create Permission"}</CardTitle>
          <CardDescription>Use simple snake_case names like manage_roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Permission name (example: manage_roles)"
            value={formName}
            onChange={(event) => setFormName(event.target.value)}
          />
          <Input
            placeholder="Description (optional)"
            value={formDescription}
            onChange={(event) => setFormDescription(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSavePermission}
              disabled={createPermissionMutation.isPending || updatePermissionMutation.isPending}
            >
              {editingPermissionId ? "Update Permission" : "Create Permission"}
            </Button>
            {editingPermissionId ? (
              <Button variant="outline" onClick={resetForm}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Permissions</CardTitle>
          <CardDescription>Search and manage current society permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search permissions..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPermissions.map((permission) => (
                <div
                  key={permission.id}
                  className="border rounded-md px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-medium">{permission.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {permission.description || "No description"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(permission)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(permission.id)}
                      disabled={deletePermissionMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {!filteredPermissions.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No permissions found.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PermissionsManagementPage

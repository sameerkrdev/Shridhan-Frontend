import { Fragment, useCallback, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconDeviceFloppy, IconLoader2, IconPencil, IconPlus, IconX } from "@tabler/icons-react";
import { useAuthSessionStore } from "@/store/authSessionStore";
import {
  useCreateCustomRoleMutation,
  useRolePermissionMatrixQuery,
  useUpdateMatrixRolePermissionsMutation,
} from "@/hooks/useMembershipApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/components/Can";

const RoleSettingsPage = () => {
  const selectedMembership = useAuthSessionStore((s) => s.selectedMembership);
  const societyId = selectedMembership?.societyId ?? null;
  const canManageRoles = hasPermission(selectedMembership?.permissions, "role.update_permissions");
  const { data: matrix, isLoading, isFetching } = useRolePermissionMatrixQuery(societyId);
  const createCustomRoleMutation = useCreateCustomRoleMutation(societyId ?? "");
  const updateRolePermissionsMutation = useUpdateMatrixRolePermissionsMutation(societyId ?? "");

  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draftRolePermissions, setDraftRolePermissions] = useState<Record<string, string[]>>({});

  const permissionMetaMap = useMemo(() => {
    const resources = matrix?.permissionCatalog?.resources ?? [];
    const resourceLabelMap = resources.reduce<Record<string, string>>((acc, resource) => {
      acc[resource.key] = resource.label;
      return acc;
    }, {});
    const definitions = matrix?.permissionCatalog?.permissions ?? [];
    return definitions.reduce<
      Record<string, { label: string; groupLabel: string; order: number; description: string }>
    >((acc, permission, index) => {
      acc[permission.key] = {
        label: permission.label,
        groupLabel: resourceLabelMap[permission.resource] ?? permission.resource,
        order: index + 1,
        description: permission.description,
      };
      return acc;
    }, {});
  }, [matrix?.permissionCatalog]);

  const getPermissionMeta = useCallback((permissionKey: string) => {
    const predefined = permissionMetaMap[permissionKey];
    if (predefined) return predefined;
    const [resource = "resource", action = permissionKey] = permissionKey.split(".");
    return { label: action, groupLabel: resource, order: 999, description: "" };
  }, [permissionMetaMap]);

  const permissions = useMemo(() => {
    const keys = matrix?.permissionKeys ?? [];
    return [...keys].sort((a, b) => getPermissionMeta(a).order - getPermissionMeta(b).order);
  }, [getPermissionMeta, matrix?.permissionKeys]);

  const roles = useMemo(() => matrix?.roles ?? [], [matrix?.roles]);
  const isOwnerActor = (selectedMembership?.role ?? "").toUpperCase() === "OWNER";

  const toggleCustomPermission = (permissionKey: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionKey)
        ? prev.filter((item) => item !== permissionKey)
        : [...prev, permissionKey],
    );
  };

  const resetCreateRoleDraft = useCallback(() => {
    setRoleName("");
    setSelectedPermissions([]);
  }, []);

  const toggleDraftPermission = (roleId: string, permissionKey: string) => {
    setDraftRolePermissions((prev) => {
      const current = prev[roleId] ?? [];
      const next = current.includes(permissionKey)
        ? current.filter((item) => item !== permissionKey)
        : [...current, permissionKey];
      return {
        ...prev,
        [roleId]: next,
      };
    });
  };

  const handleCreateRole = async () => {
    if (!societyId) return;
    if (!roleName.trim()) {
      toast.error("Role name is required");
      return;
    }
    if (!selectedPermissions.length) {
      toast.error("Select at least one permission");
      return;
    }

    try {
      await createCustomRoleMutation.mutateAsync({
        name: roleName.trim(),
        permissions: selectedPermissions,
      });
      setIsCreatePanelOpen(false);
      resetCreateRoleDraft();
      toast.success("Custom role created");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create custom role"));
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!societyId) return;
    try {
      const changedRoles = roles.filter((role) => {
        if (!(role.editable || isOwnerActor)) return false;
        const nextPermissions = draftRolePermissions[role.id] ?? role.permissions;
        const current = [...role.permissions].sort().join("|");
        const next = [...nextPermissions].sort().join("|");
        return current !== next;
      });

      for (const role of changedRoles) {
        await updateRolePermissionsMutation.mutateAsync({
          roleKey: role.key,
          permissions: draftRolePermissions[role.id] ?? role.permissions,
        });
      }
      setIsEditMode(false);
      setDraftRolePermissions({});
      toast.success(
        changedRoles.length > 0
          ? "Permissions updated successfully"
          : "No permission changes to save",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update permissions"));
    }
  };

  const hasUnsavedPermissionChanges = useMemo(() => {
    if (!isEditMode) return false;
    return roles.some((role) => {
      if (!(role.editable || isOwnerActor)) return false;
      const nextPermissions = draftRolePermissions[role.id] ?? role.permissions;
      const current = [...role.permissions].sort().join("|");
      const next = [...nextPermissions].sort().join("|");
      return current !== next;
    });
  }, [draftRolePermissions, isEditMode, isOwnerActor, roles]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Access Level Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage society access levels and permissions.
        </p>
      </div>

      <div className="space-y-4">
        <section className="space-y-4">
          {isLoading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading role matrix...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {roles.map((role) => (
                    <Badge key={role.id} variant="outline" className="px-2 py-1 text-xs font-medium">
                      {role.name}
                      {!role.editable ? (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          system
                        </Badge>
                      ) : null}
                    </Badge>
                  ))}
                </div>
                {canManageRoles ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={isEditMode ? "secondary" : "outline"}
                      onClick={() => {
                        const next = !isEditMode;
                        setIsEditMode(next);
                        if (next) {
                          const initialDraft = roles.reduce<Record<string, string[]>>((acc, role) => {
                            acc[role.id] = [...role.permissions];
                            return acc;
                          }, {});
                          setDraftRolePermissions(initialDraft);
                        } else {
                          setDraftRolePermissions({});
                        }
                      }}
                      disabled={roles.length === 0}
                    >
                      <IconPencil className="mr-2 h-4 w-4" />
                      {isEditMode ? "Editing" : "Edit Permissions"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreatePanelOpen((prev) => {
                          const next = !prev;
                          if (!next) {
                            resetCreateRoleDraft();
                          }
                          return next;
                        });
                      }}
                    >
                      <IconPlus className="mr-2 h-4 w-4" />
                      Add Role
                    </Button>
                  </div>
                ) : null}
              </div>

              {isCreatePanelOpen ? (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                    <label htmlFor="new-role-name" className="sr-only">
                      Role name
                    </label>
                    <Input
                      id="new-role-name"
                      placeholder="Role name"
                      value={roleName}
                      onChange={(event) => setRoleName(event.target.value)}
                      aria-label="Role name"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsCreatePanelOpen(false);
                          resetCreateRoleDraft();
                        }}
                      >
                        <IconX className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateRole}
                        disabled={createCustomRoleMutation.isPending}
                      >
                        {createCustomRoleMutation.isPending ? (
                          <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <IconDeviceFloppy className="mr-2 h-4 w-4" />
                        )}
                        Save Role
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select permissions for the new role from the matrix rows below.
                  </p>
                </div>
              ) : null}

              {isFetching ? <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}

              {isEditMode && canManageRoles ? (
                <div className="flex items-center justify-between gap-2">
                  <p
                    className="text-xs text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    {hasUnsavedPermissionChanges
                      ? "You have unsaved permission changes."
                      : "No unsaved changes yet."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditMode(false);
                      setDraftRolePermissions({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveRolePermissions}
                    disabled={updateRolePermissionsMutation.isPending || !hasUnsavedPermissionChanges}
                  >
                    {updateRolePermissionsMutation.isPending ? (
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconDeviceFloppy className="mr-2 h-4 w-4" />
                    )}
                    Save Permission Changes
                  </Button>
                </div>
              ) : null}

              {permissions.length === 0 ? (
                <div className="rounded-lg border bg-muted/10 p-4 text-sm text-muted-foreground">
                  No permissions are available for this society yet.
                </div>
              ) : null}

              {permissions.length > 0 ? (
                <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[280px] font-semibold">Permission</TableHead>
                        {roles.map((role) => (
                          <TableHead key={role.id} className="text-center font-semibold">
                            {role.name}
                          </TableHead>
                        ))}
                        {isCreatePanelOpen ? (
                          <TableHead className="text-center font-semibold">New Role</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.map((permissionKey, index) => {
                        const meta = getPermissionMeta(permissionKey);
                        const previousGroup =
                          index > 0 ? getPermissionMeta(permissions[index - 1]).groupLabel : null;
                        const showGroupHeader = previousGroup !== meta.groupLabel;

                        return (
                          <Fragment key={permissionKey}>
                            {showGroupHeader ? (
                              <TableRow className="bg-muted/20 hover:bg-muted/20">
                                <TableCell className="font-semibold text-muted-foreground uppercase text-xs">
                                  {meta.groupLabel}
                                </TableCell>
                                <TableCell
                                  colSpan={Math.max(1, roles.length + (isCreatePanelOpen ? 1 : 0))}
                                />
                              </TableRow>
                            ) : null}
                            <TableRow>
                              <TableCell className="pl-6">
                                <div className="font-medium">{meta.label}</div>
                                {meta.description ? (
                                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                                ) : null}
                              </TableCell>
                              {roles.map((role) => {
                                const value =
                                  isEditMode
                                    ? (draftRolePermissions[role.id] ?? role.permissions)
                                    : role.permissions;
                                const isChecked = value.includes(permissionKey);
                                const canEditCell =
                                  canManageRoles &&
                                  isEditMode &&
                                  (role.editable || isOwnerActor);
                                return (
                                  <TableCell key={`${role.id}-${permissionKey}`} className="text-center">
                                    <Checkbox
                                      checked={isChecked}
                                      disabled={!canEditCell}
                                      className={!canEditCell ? "pointer-events-none opacity-80" : ""}
                                      aria-label={`${role.name}: ${meta.label}`}
                                      onCheckedChange={() => {
                                        if (!canEditCell) return;
                                        toggleDraftPermission(role.id, permissionKey);
                                      }}
                                    />
                                  </TableCell>
                                );
                              })}
                              {isCreatePanelOpen ? (
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={selectedPermissions.includes(permissionKey)}
                                    aria-label={`New role: ${meta.label}`}
                                    onCheckedChange={() => toggleCustomPermission(permissionKey)}
                                  />
                                </TableCell>
                              ) : null}
                            </TableRow>
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default RoleSettingsPage;

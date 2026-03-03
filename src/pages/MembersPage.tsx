import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconSearch, IconUserPlus } from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuthSessionStore } from "@/store/authSessionStore";
import {
  useMembersQuery,
  useAssignableRoleOptionsQuery,
  useUpdateRoleMutation,
  useUpdateStatusMutation,
  useRemoveMemberMutation,
} from "@/hooks/useMembershipApi";
import { AddMemberDialog } from "@/dialogs/AddMemberDialog";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import type { MembershipStatus } from "@/types/auth";
import type { MembershipWithUser } from "@/lib/membershipApi";
import { Can, hasPermission } from "@/components/Can";
import { formatDate } from "@/lib/dateFormat";

const STATUS_LABELS: Record<MembershipStatus, string> = {
  active: "Active",
  suspended: "Suspended",
};

const MembersPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MembershipWithUser | null>(null);

  const selectedMembership = useAuthSessionStore((s) => s.selectedMembership);
  const societyId = selectedMembership?.societyId ?? null;
  const actorPermissions = selectedMembership?.permissions ?? [];
  const canUpdateRolePermission = hasPermission(actorPermissions, "membership.update_role");
  const canUpdateStatusPermission = hasPermission(actorPermissions, "membership.update_status");

  const { data: members, isLoading } = useMembersQuery(societyId, showDeletedUsers);
  const { data: roleOptions } = useAssignableRoleOptionsQuery(societyId);
  const updateRoleMutation = useUpdateRoleMutation(societyId ?? "");
  const updateStatusMutation = useUpdateStatusMutation(societyId ?? "");
  const removeMemberMutation = useRemoveMemberMutation(societyId ?? "");

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      const q = searchQuery.toLowerCase();
      return (
        m.user.name.toLowerCase().includes(q) ||
        (m.user.email?.toLowerCase().includes(q) ?? false) ||
        m.user.phone.includes(q) ||
        m.role.name.toLowerCase().includes(q)
      );
    });
  }, [members, searchQuery]);
  const activeOwnerCount = useMemo(
    () => (members ?? []).filter((member) => !member.deletedAt && member.role.name === "OWNER").length,
    [members],
  );

  const handleRoleChange = async (membership: MembershipWithUser, newRoleId: string) => {
    const roleLabel = [...(roleOptions?.baseRoles ?? []), ...(roleOptions?.customRoles ?? [])].find(
      (item) => item.id === newRoleId,
    )?.name;
    try {
      await updateRoleMutation.mutateAsync({ membershipId: membership.id, roleId: newRoleId });
      toast.success(`Access level changed to ${roleLabel ?? "selected role"}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to change access level"));
    }
  };

  const handleStatusToggle = async (membership: MembershipWithUser) => {
    if (membership.deletedAt) return;
    const newStatus: MembershipStatus = membership.status === "active" ? "suspended" : "active";
    try {
      await updateStatusMutation.mutateAsync({ membershipId: membership.id, status: newStatus });
      toast.success(`Member ${newStatus === "active" ? "activated" : "suspended"}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update status"));
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeMemberMutation.mutateAsync(removeTarget.id);
      toast.success("Member removed from society");
      setRemoveTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to remove member"));
    }
  };

  const canManageTarget = (target: MembershipWithUser) => {
    if (target.deletedAt) {
      return false;
    }
    if (target.id === selectedMembership?.membershipId) {
      return false;
    }
    return target.role.permissions.every((permission) => actorPermissions.includes(permission));
  };
  const isLastOwner = (target: MembershipWithUser) =>
    !target.deletedAt && target.role.name === "OWNER" && activeOwnerCount <= 1;

  const availableRoles = [...(roleOptions?.baseRoles ?? []), ...(roleOptions?.customRoles ?? [])];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Manage Members
        </h1>
        <p className="text-muted-foreground mt-2">Add, manage, and control access for society members</p>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showDeletedUsers ? "secondary" : "outline"}
              onClick={() => setShowDeletedUsers((prev) => !prev)}
            >
              {showDeletedUsers ? "Hide Deleted Users" : "Show Deleted Users"}
            </Button>
            <Can action="membership.create">
              <Button className="gap-2" onClick={() => setIsAddOpen(true)}>
                <IconUserPlus className="h-4 w-4" />
                Add Member
              </Button>
            </Can>
          </div>
        </div>
      </div>

      <div className="overflow-auto">
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/70">
                <TableHead className="font-semibold min-w-[200px]">Name</TableHead>
                <TableHead className="font-semibold min-w-[220px]">Email</TableHead>
                <TableHead className="font-semibold min-w-[150px]">Phone</TableHead>
                <TableHead className="font-semibold min-w-[160px]">Access Level</TableHead>
                <TableHead className="font-semibold min-w-[120px]">Status</TableHead>
                <TableHead className="font-semibold text-center min-w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Loading members...
                  </TableCell>
                </TableRow>
              ) : filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                          {m.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span>{m.user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.user.email ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{m.user.phone}</TableCell>
                    <TableCell>
                      {canManageTarget(m) && canUpdateRolePermission ? (
                        <Select
                          value={m.roleId}
                          onValueChange={(val) => handleRoleChange(m, val)}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={m.roleId}>{m.role.name}</SelectItem>
                            {availableRoles
                              .filter((r) => r.id !== m.roleId)
                              .map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{m.role.name}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.deletedAt ? (
                        <Badge variant="destructive">Deleted</Badge>
                      ) : canManageTarget(m) && canUpdateStatusPermission ? (
                        <Button
                          variant={m.status === "active" ? "outline" : "destructive"}
                          size="sm"
                          onClick={() => handleStatusToggle(m)}
                          disabled={updateStatusMutation.isPending}
                        >
                          {STATUS_LABELS[m.status]}
                        </Button>
                      ) : (
                        <Badge variant={m.status === "active" ? "default" : "destructive"}>
                          {STATUS_LABELS[m.status]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.deletedAt ? (
                        <span className="text-xs text-muted-foreground">
                          Deleted on {formatDate(m.deletedAt)}
                        </span>
                      ) : canManageTarget(m) && (
                        <Can action="membership.remove">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setRemoveTarget(m)}
                            disabled={isLastOwner(m)}
                          >
                            Remove
                          </Button>
                        </Can>
                      )}
                      {!m.deletedAt && isLastOwner(m) ? (
                        <div className="text-[11px] text-amber-600 mt-1">Last owner cannot be removed.</div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Showing {filteredMembers.length} of {members?.length ?? 0} members
        </div>
      </div>

      <AddMemberDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        societyId={societyId ?? ""}
      />

      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{removeTarget?.user.name}</strong> from this society?
              This action can be undone by re-adding them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MembersPage;

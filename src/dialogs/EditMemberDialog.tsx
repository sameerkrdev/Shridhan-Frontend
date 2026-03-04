import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLoader2 } from "@tabler/icons-react";
import { useUpdateStatusMutation } from "@/hooks/useMembershipApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import type { MembershipStatus } from "@/types/auth";
import type { MembershipWithUser } from "@/lib/membershipApi";
import { useState } from "react";

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MembershipWithUser | null;
  societyId: string;
}

export const EditMemberDialog = ({
  open,
  onOpenChange,
  member,
  societyId,
}: EditMemberDialogProps) => {
  const [selectedStatus, setSelectedStatus] = useState<MembershipStatus | null>(null);

  const updateStatusMutation = useUpdateStatusMutation(societyId);

  if (!member) return null;

  const currentRole = member.role.name;
  const currentStatus = selectedStatus ?? member.status;
  const canModify = true;

  const handleSave = async () => {
    try {
      if (selectedStatus && selectedStatus !== member.status) {
        await updateStatusMutation.mutateAsync({
          membershipId: member.id,
          status: selectedStatus,
        });
      }
      toast.success("Member updated");
      onOpenChange(false);
      setSelectedStatus(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update member"));
    }
  };

  const hasChanges =
    selectedStatus && selectedStatus !== member.status;

  const isSaving = updateStatusMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>
            Update access level and status for {member.user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={member.user.name} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={member.user.email ?? "—"} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={member.user.phone} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Access Level</Label>
            <Input value={currentRole} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            {canModify ? (
              <Select
                value={currentStatus}
                onValueChange={(val) => setSelectedStatus(val as MembershipStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={currentStatus === "active" ? "Active" : "Suspended"}
                disabled
                className="bg-muted"
              />
            )}
          </div>

          {canModify && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="flex-1"
              >
                {isSaving ? <IconLoader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconTrash } from "@tabler/icons-react";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
}

interface RemoveMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onConfirm: () => void;
}

export const RemoveMemberDialog = ({
  open,
  onOpenChange,
  member,
  onConfirm,
}: RemoveMemberDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Remove Team Member</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove{" "}
            <span className="font-semibold text-foreground">
              {member?.name}
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="gap-2">
            <IconTrash className="h-4 w-4" />
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

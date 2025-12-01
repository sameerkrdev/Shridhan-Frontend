import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IconUserPlus } from "@tabler/icons-react";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
}

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddMember: (member: Omit<TeamMember, "id">) => void;
  availableRoles: string[];
}

export const AddMemberDialog = ({
  open,
  onOpenChange,
  onAddMember,
  availableRoles,
}: AddMemberDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    role: "",
  });

  const handleSubmit = () => {
    // Validate form
    if (
      !formData.name ||
      !formData.email ||
      !formData.phoneNumber ||
      !formData.role
    ) {
      alert("Please fill in all fields");
      return;
    }

    onAddMember(formData);

    // Reset form
    setFormData({
      name: "",
      email: "",
      phoneNumber: "",
      role: "",
    });

    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset form
    setFormData({
      name: "",
      email: "",
      phoneNumber: "",
      role: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Team Member</DialogTitle>
          <DialogDescription>
            Enter the details for the new team member
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="add-name">Name</Label>
            <Input
              id="add-name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-email">Email</Label>
            <Input
              id="add-email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="Enter email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-phone">Phone Number</Label>
            <Input
              id="add-phone"
              value={formData.phoneNumber}
              onChange={(e) =>
                setFormData({ ...formData, phoneNumber: e.target.value })
              }
              placeholder="Enter phone number"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger id="add-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="gap-2">
            <IconUserPlus className="h-4 w-4" />
            Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

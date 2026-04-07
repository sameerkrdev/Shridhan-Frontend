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
import {
  useUpdateStatusMutation,
  useUpdateMemberContactMutation,
  useSendMemberPhoneOtpMutation,
  useVerifyMemberPhoneOtpMutation,
  useSendMemberEmailOtpMutation,
  useVerifyMemberEmailOtpMutation,
} from "@/hooks/useMembershipApi";
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
  const [selectedStatus, setSelectedStatus] = useState<MembershipStatus | null>(member?.status ?? null);
  const [phone, setPhone] = useState(member?.user.phone ?? "");
  const [email, setEmail] = useState(member?.user.email ?? "");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const updateStatusMutation = useUpdateStatusMutation(societyId);
  const updateContactMutation = useUpdateMemberContactMutation(societyId);
  const sendPhoneOtpMutation = useSendMemberPhoneOtpMutation();
  const verifyPhoneOtpMutation = useVerifyMemberPhoneOtpMutation();
  const sendEmailOtpMutation = useSendMemberEmailOtpMutation();
  const verifyEmailOtpMutation = useVerifyMemberEmailOtpMutation();

  if (!member) return null;

  const currentRole = member.role.name;
  const currentStatus = selectedStatus ?? member.status;
  const canModify = true;
  const phoneChanged = phone.trim() !== member.user.phone;
  const emailChanged = email.trim() !== (member.user.email ?? "");

  const handleSave = async () => {
    try {
      if (phoneChanged) {
        if (!phoneVerified) {
          toast.error("Verify new phone with OTP before saving");
          return;
        }
        if (phoneOtp.trim().length !== 6) {
          toast.error("Enter 6-digit phone OTP");
          return;
        }
      }
      if (emailChanged && email.trim()) {
        if (!emailVerified) {
          toast.error("Verify new email with OTP before saving");
          return;
        }
        if (emailOtp.trim().length !== 6) {
          toast.error("Enter 6-digit email OTP");
          return;
        }
      }
      if (emailChanged && !email.trim()) {
        toast.error("Email cannot be empty");
        return;
      }
      if (phoneChanged || emailChanged) {
        await updateContactMutation.mutateAsync({
          membershipId: member.id,
          payload: {
            phone: phone.trim(),
            email: email.trim(),
            phoneOtp: phoneChanged ? phoneOtp.trim() : undefined,
            emailOtp: emailChanged && email.trim() ? emailOtp.trim() : undefined,
          },
        });
      }
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
    (selectedStatus && selectedStatus !== member.status) || phoneChanged || emailChanged;

  const isSaving = updateStatusMutation.isPending || updateContactMutation.isPending;

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
            <Input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailOtp("");
                setEmailVerified(false);
              }}
              placeholder="Email (optional)"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setPhoneOtp("");
                setPhoneVerified(false);
              }}
              placeholder="Phone number"
            />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Phone OTP Verification</Label>
              {!phoneChanged ? (
                <span className="text-xs text-muted-foreground">No phone change</span>
              ) : phoneVerified ? (
                <span className="text-xs text-emerald-600">Verified</span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Input
                value={phoneOtp}
                onChange={(event) => setPhoneOtp(event.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                disabled={!phoneChanged || phoneVerified}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!phoneChanged || sendPhoneOtpMutation.isPending || !phone.trim()}
                onClick={async () => {
                  try {
                    await sendPhoneOtpMutation.mutateAsync(phone.trim());
                    toast.success("Phone OTP sent");
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, "Failed to send phone OTP"));
                  }
                }}
              >
                Send OTP
              </Button>
              <Button
                type="button"
                disabled={!phoneChanged || phoneVerified || phoneOtp.length !== 6}
                onClick={async () => {
                  try {
                    await verifyPhoneOtpMutation.mutateAsync({ phone: phone.trim(), otp: phoneOtp.trim() });
                    setPhoneVerified(true);
                    toast.success("Phone verified");
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, "Invalid phone OTP"));
                  }
                }}
              >
                Verify
              </Button>
            </div>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Email OTP Verification</Label>
              {!emailChanged || !email.trim() ? (
                <span className="text-xs text-muted-foreground">No email change</span>
              ) : emailVerified ? (
                <span className="text-xs text-emerald-600">Verified</span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Input
                value={emailOtp}
                onChange={(event) => setEmailOtp(event.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                disabled={!emailChanged || !email.trim() || emailVerified}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!emailChanged || !email.trim() || sendEmailOtpMutation.isPending}
                onClick={async () => {
                  try {
                    await sendEmailOtpMutation.mutateAsync(email.trim());
                    toast.success("Email OTP sent");
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, "Failed to send email OTP"));
                  }
                }}
              >
                Send OTP
              </Button>
              <Button
                type="button"
                disabled={!emailChanged || !email.trim() || emailVerified || emailOtp.length !== 6}
                onClick={async () => {
                  try {
                    await verifyEmailOtpMutation.mutateAsync({ email: email.trim(), otp: emailOtp.trim() });
                    setEmailVerified(true);
                    toast.success("Email verified");
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, "Invalid email OTP"));
                  }
                }}
              >
                Verify
              </Button>
            </div>
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

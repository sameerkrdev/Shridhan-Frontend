import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconSearch, IconUserPlus, IconLoader2 } from "@tabler/icons-react";
import {
  useSearchUserMutation,
  useAddMemberMutation,
  useAssignableRoleOptionsQuery,
  useSendMemberPhoneOtpMutation,
  useVerifyMemberPhoneOtpMutation,
  useSendMemberEmailOtpMutation,
  useVerifyMemberEmailOtpMutation,
} from "@/hooks/useMembershipApi";
import { toast } from "sonner";
import { z } from "zod";
import { getApiErrorMessage } from "@/lib/apiError";
import type { User } from "@/types/auth";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
}

type Step = "search" | "found" | "create";

export const AddMemberDialog = ({
  open,
  onOpenChange,
  societyId,
}: AddMemberDialogProps) => {
  const [step, setStep] = useState<Step>("search");
  const [searchInput, setSearchInput] = useState("");
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [roleId, setRoleId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const searchMutation = useSearchUserMutation();
  const addMutation = useAddMemberMutation(societyId);
  const sendPhoneOtpMutation = useSendMemberPhoneOtpMutation();
  const verifyPhoneOtpMutation = useVerifyMemberPhoneOtpMutation();
  const sendEmailOtpMutation = useSendMemberEmailOtpMutation();
  const verifyEmailOtpMutation = useVerifyMemberEmailOtpMutation();
  const { data: roleOptions, isLoading: isRoleOptionsLoading } = useAssignableRoleOptionsQuery(
    societyId || null,
  );

  const availableRoles = [...(roleOptions?.baseRoles ?? []), ...(roleOptions?.customRoles ?? [])];
  const selectedRoleId = roleId || availableRoles[0]?.id || "";

  const reset = () => {
    setStep("search");
    setSearchInput("");
    setFoundUser(null);
    setRoleId(availableRoles[0]?.id ?? "");
    setName("");
    setEmail("");
    setPhone("");
    setPhoneOtp("");
    setEmailOtp("");
    setPhoneVerified(false);
    setEmailVerified(false);
    searchMutation.reset();
    addMutation.reset();
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleSearch = async () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    if (trimmed.includes("@")) {
      const parsed = z.email("Enter a valid email address").safeParse(trimmed);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Invalid email");
        return;
      }
    }
    try {
      const result = await searchMutation.mutateAsync(trimmed);
      if (result.found && result.user) {
        setFoundUser(result.user);
        setStep("found");
      } else {
        setStep("create");
        if (searchInput.includes("@")) {
          setEmail(searchInput.trim());
        } else {
          setPhone(searchInput.trim());
        }
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Search failed"));
    }
  };

  const handleAddExisting = async () => {
    if (!foundUser) return;
    if (!selectedRoleId) {
      toast.error("No assignable role available");
      return;
    }
    try {
      await addMutation.mutateAsync({
        userId: foundUser.id,
        email: foundUser.email,
        roleId: selectedRoleId,
      });
      toast.success(`${foundUser.name} has been added to the society`);
      handleClose(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to add member"));
    }
  };

  const handleCreateAndAdd = async () => {
    if (!selectedRoleId) {
      toast.error("No assignable role available");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const parsedPhone = z
      .string()
      .regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian number")
      .safeParse(phone.trim());
    if (!parsedPhone.success) {
      toast.error(parsedPhone.error.issues[0]?.message ?? "Invalid phone");
      return;
    }
    if (!phoneVerified) {
      toast.error("Verify phone with OTP before creating member");
      return;
    }
    const normalizedEmail = email.trim();
    if (normalizedEmail) {
      const parsedEmail = z.email("Enter a valid email address").safeParse(normalizedEmail);
      if (!parsedEmail.success) {
        toast.error(parsedEmail.error.issues[0]?.message ?? "Invalid email");
        return;
      }
      if (!emailVerified) {
        toast.error("Verify email with OTP before creating member");
        return;
      }
    }
    if (phoneOtp.length !== 6) {
      toast.error("Enter 6-digit phone OTP");
      return;
    }
    try {
      await addMutation.mutateAsync({
        name: name.trim(),
        email: normalizedEmail || undefined,
        phone: phone.trim(),
        phoneOtp: phoneOtp.trim(),
        emailOtp: normalizedEmail ? emailOtp.trim() : undefined,
        roleId: selectedRoleId,
      });
      toast.success(`${name} has been created and added to the society`);
      handleClose(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create and add member"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconUserPlus className="h-5 w-5" />
            Add Member
          </DialogTitle>
          <DialogDescription>
            {step === "search" && "Search for an existing user by email or phone number"}
            {step === "found" && "User found! Choose their access level and add them."}
            {step === "create" && "User not found. Enter their details to create and add them."}
          </DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="search">Email or Phone</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Enter email or phone number"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button
                  onClick={handleSearch}
                  disabled={searchMutation.isPending || !searchInput.trim()}
                >
                  {searchMutation.isPending ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconSearch className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "found" && foundUser && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Name</span>
                <p className="font-medium">{foundUser.name}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Email</span>
                <p className="text-sm">{foundUser.email ?? "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Phone</span>
                <p className="text-sm font-mono">{foundUser.phone}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Access Level</Label>
              <Select value={selectedRoleId} onValueChange={(val) => setRoleId(val)}>
                <SelectTrigger>
                  <SelectValue placeholder={isRoleOptionsLoading ? "Loading..." : "Select access level"} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={reset} className="flex-1">
                Back
              </Button>
              <Button onClick={handleAddExisting} disabled={addMutation.isPending} className="flex-1">
                {addMutation.isPending ? (
                  <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Add to Society
              </Button>
            </div>
          </div>
        )}

        {step === "create" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email address (optional)"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailVerified(false);
                  setEmailOtp("");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneVerified(false);
                  setPhoneOtp("");
                }}
              />
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Phone OTP Verification</Label>
                {phoneVerified ? <span className="text-xs text-emerald-600">Verified</span> : null}
              </div>
              <div className="flex gap-2">
                <Input
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  disabled={phoneVerified}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={sendPhoneOtpMutation.isPending || !phone.trim()}
                  onClick={async () => {
                    const parsedPhone = z
                      .string()
                      .regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian number")
                      .safeParse(phone.trim());
                    if (!parsedPhone.success) {
                      toast.error(parsedPhone.error.issues[0]?.message ?? "Invalid phone");
                      return;
                    }
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
                  disabled={verifyPhoneOtpMutation.isPending || phoneVerified || phoneOtp.length !== 6}
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
                <Label>Email OTP Verification (optional)</Label>
                {emailVerified ? <span className="text-xs text-emerald-600">Verified</span> : null}
              </div>
              <div className="flex gap-2">
                <Input
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  disabled={emailVerified || !email.trim()}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={sendEmailOtpMutation.isPending || !email.trim()}
                  onClick={async () => {
                    const parsedEmail = z.email("Enter a valid email address").safeParse(email.trim());
                    if (!parsedEmail.success) {
                      toast.error(parsedEmail.error.issues[0]?.message ?? "Invalid email");
                      return;
                    }
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
                  disabled={
                    verifyEmailOtpMutation.isPending ||
                    emailVerified ||
                    !email.trim() ||
                    emailOtp.length !== 6
                  }
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
              <Select value={selectedRoleId} onValueChange={(val) => setRoleId(val)}>
                <SelectTrigger>
                  <SelectValue placeholder={isRoleOptionsLoading ? "Loading..." : "Select access level"} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={reset} className="flex-1">
                Back
              </Button>
              <Button onClick={handleCreateAndAdd} disabled={addMutation.isPending} className="flex-1">
                {addMutation.isPending ? (
                  <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create & Add
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

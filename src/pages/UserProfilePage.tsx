import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IconBuildingCommunity,
  IconCalendar,
  IconLoader2,
  IconMail,
  IconPhone,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  useLeaveSocietyMutation,
  useMyMembershipsQuery,
  useUserProfileQuery,
  useUpdateProfileMutation,
} from "@/hooks/useMembershipApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { useNavigate } from "react-router";
import type { UserMembershipProfile } from "@/lib/membershipApi";
import { formatDate } from "@/lib/dateFormat";
import { userProfileUpdateSchema } from "@/lib/UserProfileZodValidatorSchema";

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useUserProfileQuery();
  const { data: myMemberships, isLoading: isMembershipLoading } = useMyMembershipsQuery();
  const updateMutation = useUpdateProfileMutation();
  const leaveSocietyMutation = useLeaveSocietyMutation();
  const setAuthPayload = useAuthSessionStore((s) => s.setAuthPayload);
  const selectedMembership = useAuthSessionStore((s) => s.selectedMembership);
  const memberships = useAuthSessionStore((s) => s.memberships);
  const routeIntent = useAuthSessionStore((s) => s.routeIntent);
  const user = useAuthSessionStore((s) => s.user);

  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<UserMembershipProfile | null>(null);
  const currentName = name ?? profile?.name ?? "";
  const currentPhone = phone ?? profile?.phone ?? "";
  const hasChanges = profile && (currentName !== profile.name || currentPhone !== profile.phone);
  const initials = useMemo(
    () =>
      (currentName || profile?.name || "U")
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase())
        .slice(0, 2)
        .join(""),
    [currentName, profile?.name],
  );

  const membershipsForView = useMemo(() => {
    if (myMemberships?.length) return myMemberships;
    return memberships.map((membership) => ({
      membershipId: membership.membershipId,
      societyId: membership.societyId,
      societyName: membership.societyName,
      subDomainName: membership.subDomainName,
      roleId: membership.roleId,
      role: membership.role,
      status: membership.status,
      joinedAt: "",
      canLeave: membership.role !== "OWNER",
    }));
  }, [memberships, myMemberships]);

  const handleSave = async () => {
    try {
      const validated = userProfileUpdateSchema.safeParse({
        name: currentName,
        phone: currentPhone,
      });
      if (!validated.success) {
        toast.error(validated.error.issues[0]?.message ?? "Please check profile details");
        return;
      }

      const updated = await updateMutation.mutateAsync({
        ...(validated.data.name !== profile?.name && { name: validated.data.name }),
        ...(validated.data.phone !== profile?.phone && { phone: validated.data.phone }),
      });

      if (user) {
        setAuthPayload({
          user: { ...user, name: updated.name, phone: updated.phone },
          routeIntent: "SOCIETY_SELECTOR",
          memberships: useAuthSessionStore.getState().memberships,
        });
      }

      toast.success("Profile updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to update profile"));
    }
  };

  const handleLeaveSociety = async () => {
    if (!leaveTarget || !user) return;
    try {
      await leaveSocietyMutation.mutateAsync(leaveTarget.societyId);
      const remainingMemberships = memberships.filter(
        (membership) => membership.societyId !== leaveTarget.societyId,
      );

      setAuthPayload({
        user,
        routeIntent: routeIntent ?? "SOCIETY_SELECTOR",
        memberships: remainingMemberships,
      });

      toast.success(`You have left ${leaveTarget.societyName}`);
      if (selectedMembership?.societyId === leaveTarget.societyId) {
        navigate("/society-selector");
      }
      setLeaveTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to leave society"));
    }
  };

  if (isLoading || isMembershipLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          My Profile
        </h1>
        <p className="text-muted-foreground mt-2">Manage your personal information</p>
      </div>

      <section className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border border-border/70">
                <AvatarImage src={profile?.avatar ?? ""} alt={profile?.name ?? "User avatar"} />
                <AvatarFallback className="text-lg font-semibold">{initials || "U"}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-xl font-semibold tracking-tight">{profile?.name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <IconMail className="h-4 w-4" />
                  {profile?.email}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <IconPhone className="h-4 w-4" />
                  {currentPhone || "N/A"}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="w-fit">
              {membershipsForView.length} societ{membershipsForView.length === 1 ? "y" : "ies"}
            </Badge>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={currentName}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={currentPhone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Your phone number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile?.email ?? "—"} disabled className="bg-muted/40" />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed here. Contact support if you need to update it.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
              {updateMutation.isPending ? (
                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Your Societies</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Role and join date across all societies you are part of.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {membershipsForView.length === 0 ? (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardContent className="py-8 text-sm text-muted-foreground">
                You are not currently part of any society.
              </CardContent>
            </Card>
          ) : (
            membershipsForView.map((membership) => (
              <Card
                key={membership.membershipId}
                className="group h-full border-border/70 bg-card/70 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="line-clamp-1 text-base">{membership.societyName}</CardTitle>
                      <CardDescription className="line-clamp-1 text-xs">
                        @{membership.subDomainName}
                      </CardDescription>
                    </div>
                    <IconBuildingCommunity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium text-right">{membership.role}</span>
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <IconCalendar className="h-3.5 w-3.5" />
                      Joined
                    </span>
                    <span className="font-medium text-right">
                      {formatDate(membership.joinedAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={membership.status === "active" ? "outline" : "destructive"}>
                      {membership.status}
                    </Badge>
                    <Badge variant="secondary">Access: {membership.role}</Badge>
                  </div>
                </CardContent>
                <CardFooter className="mt-auto flex flex-col items-stretch gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-between text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setLeaveTarget(membership)}
                    disabled={leaveSocietyMutation.isPending || membership.canLeave === false}
                  >
                    Leave
                  </Button>
                  <p className={`text-xs ${membership.canLeave === false ? "text-amber-600" : "invisible"}`}>
                    {membership.canLeave === false ? "Last owner cannot leave this society." : "placeholder"}
                  </p>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </section>

      <AlertDialog open={Boolean(leaveTarget)} onOpenChange={(open) => !open && setLeaveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave society</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave <strong>{leaveTarget?.societyName}</strong>? You may need an invite to
              rejoin later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveSociety}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaveSocietyMutation.isPending ? (
                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserProfilePage;

import { useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowRight, Building2, GalleryVerticalEnd, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useMemberSocietiesQuery,
  useResolveSelectedSocietyMutation,
} from "@/hooks/useAuthApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { getApiErrorMessage } from "@/lib/apiError";

const toReadableLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  const normalizedStatus = status.toUpperCase();
  if (normalizedStatus === "ACTIVE") return "default";
  if (normalizedStatus.includes("FAILED") || normalizedStatus.includes("CANCELLED")) return "destructive";
  if (normalizedStatus.includes("PENDING") || normalizedStatus === "CREATED") return "secondary";
  return "outline";
};

const SocietySelectorPage = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthSessionStore((state) => state.isAuthenticated);
  const memberships = useAuthSessionStore((state) => state.memberships);
  const setMemberships = useAuthSessionStore((state) => state.setMemberships);
  const setResolvedSociety = useAuthSessionStore((state) => state.setResolvedSociety);

  const shouldFetchMemberships = isAuthenticated && memberships.length === 0;
  const { data, isLoading } = useMemberSocietiesQuery(shouldFetchMemberships);
  const resolveSocietyMutation = useResolveSelectedSocietyMutation();

  useEffect(() => {
    if (data) {
      setMemberships(data);
    }
  }, [data, setMemberships]);

  const handleSelectSociety = async (societyId: string) => {
    try {
      const response = await resolveSocietyMutation.mutateAsync(societyId);
      setResolvedSociety(response);
      navigate(response.nextRoute);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to resolve selected society"));
    }
  };

  return (
    <div className="min-h-svh bg-background p-6 md:p-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Shridhan
          </a>
        </div>

        <div>
          <Card className="border-border/60 bg-card/60">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-2xl">Select Society</CardTitle>
                <Badge variant="secondary">{memberships.length} Available</Badge>
              </div>
              <CardDescription className="text-sm">
                Continue with an existing society or create a new one to onboard your team.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading && (
            <Card className="md:col-span-2">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Loading societies...
              </CardContent>
            </Card>
          )}

          {memberships.map((m) => (
            <Card
              key={m.societyId}
              className="group border-border/70 bg-card/70 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-1">{m.societyName}</CardTitle>
                    <CardDescription className="line-clamp-1 text-xs">
                      {m.subDomainName}.shridhan.app
                    </CardDescription>
                  </div>
                  <Building2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getStatusVariant(m.societyStatus)}>
                    Status: {toReadableLabel(m.societyStatus)}
                  </Badge>
                  <Badge variant="outline">Access: {toReadableLabel(m.role)}</Badge>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full justify-between"
                  onClick={() => handleSelectSociety(m.societyId)}
                  disabled={resolveSocietyMutation.isPending}
                >
                  <span>{resolveSocietyMutation.isPending ? "Please wait..." : "Continue"}</span>
                  <ArrowRight className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}

          <Card className="border-dashed">
            <CardHeader className="space-y-2">
              <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
                <PlusCircle className="size-5" />
              </div>
              <CardTitle>Add Society</CardTitle>
              <CardDescription>Create and onboard a new society.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full justify-between" variant="outline" onClick={() => navigate("/onboarding")}>
                Create New Society
                <ArrowRight className="size-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SocietySelectorPage;

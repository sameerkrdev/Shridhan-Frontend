import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { useSetupPermitRulesMutation } from "@/hooks/useAuthApi";

const PermitPendingPage = () => {
  const navigate = useNavigate();
  const selectedSociety = useAuthSessionStore((state) => state.selectedSociety);
  const setSelectedSociety = useAuthSessionStore((state) => state.setSelectedSociety);
  const setupPermitRulesMutation = useSetupPermitRulesMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runSetup = async () => {
    if (!selectedSociety?.societyId) {
      setErrorMessage("Society not found");
      return;
    }

    setErrorMessage(null);
    try {
      const response = await setupPermitRulesMutation.mutateAsync(selectedSociety.societyId);
      setSelectedSociety({
        ...selectedSociety,
        status: response.status,
      });
      navigate(response.nextRoute, { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Permit rule setup failed"));
    }
  };

  useEffect(() => {
    void runSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold">Setting Up Permit Rules</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Please wait while we configure society access rules.
        </p>

        {setupPermitRulesMutation.isPending ? (
          <div className="mt-6 inline-flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Creating rules...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button onClick={() => void runSetup()} disabled={setupPermitRulesMutation.isPending}>
              Create Rules Again
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PermitPendingPage;

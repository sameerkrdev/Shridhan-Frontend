import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { IconX } from "@tabler/icons-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthSessionStore } from "@/store/authSessionStore";
import FullPageLoader from "@/components/ui/full-page-loader";
import { useSocietyBillingOverviewQuery } from "@/hooks/useAuthApi";
import { formatDate } from "@/lib/dateFormat";

const AuthorizedLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const isAuthenticated = useAuthSessionStore((state) => state.isAuthenticated);
  const hadSession = useAuthSessionStore((state) => state.hadSession);
  const hasRestoredSession = useAuthSessionStore((state) => state.hasRestoredSession);
  const selectedMembership = useAuthSessionStore((state) => state.selectedMembership);
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [dismissedBannerForSocietyId, setDismissedBannerForSocietyId] = useState<string | null>(
    null,
  );

  const { data: billingOverview } = useSocietyBillingOverviewQuery(
    selectedMembership?.societyId ?? null,
    Boolean(selectedMembership?.societyId),
  );

  useEffect(() => {
    if (!billingOverview || !selectedMembership?.societyId) {
      return;
    }

    const shouldRedirectToMandate = Boolean(
      !billingOverview.override.enabled &&
      !billingOverview.trial.isActive &&
      billingOverview.subscription?.status !== "ACTIVE" &&
      location.pathname !== "/billing",
    );

    if (shouldRedirectToMandate) {
      navigate("/onboarding/razorpay", { replace: true });
    }
  }, [billingOverview, selectedMembership?.societyId, location.pathname, navigate]);

  const shouldShowTrialBanner = Boolean(
    billingOverview &&
    billingOverview.trial.isActive &&
    !billingOverview.override.enabled &&
    billingOverview.subscription?.status !== "ACTIVE",
  );
  const showTrialBanner =
    shouldShowTrialBanner && dismissedBannerForSocietyId !== selectedMembership?.societyId;

  useEffect(() => {
    if (!billingOverview || !selectedMembership?.societyId) return;

    const shouldShowFeeModal =
      billingOverview.trial.isActive &&
      !billingOverview.override.enabled &&
      billingOverview.subscription?.status !== "ACTIVE";
    if (!shouldShowFeeModal) return;

    const reminderWindow = (billingOverview.trial.daysRemaining ?? 999) <= 3;
    const oneTimeSeenKey = `subscription-mandate-modal-once:${selectedMembership.societyId}`;
    const alreadySeen = localStorage.getItem(oneTimeSeenKey) === "1";
    if (!reminderWindow && alreadySeen) return;

    const timer = window.setTimeout(() => {
      setIsFeeModalOpen(true);
      if (!reminderWindow) {
        localStorage.setItem(oneTimeSeenKey, "1");
      }
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [billingOverview, selectedMembership?.societyId, location.pathname]);

  const isSessionRestorePending = hadSession && !hasRestoredSession;

  if (!isHydrated || isSessionRestorePending) return <FullPageLoader />;
  if (!isAuthenticated) {
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }
  if (!selectedMembership) return <Navigate to="/society-selector" replace />;

  return (
    <div>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6">
                  {showTrialBanner ? (
                    <div className="mb-4 rounded-md border bg-amber-50 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
                      <div className="px-4 py-2">
                        <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                          <span>
                            Your trial ends at{" "}
                            {billingOverview?.trial.endAt
                              ? formatDate(billingOverview.trial.endAt)
                              : "N/A"}
                            . Complete subscription mandate setup to avoid permission blocking.
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="xs"
                              className="flex-1 sm:w-auto"
                              onClick={() => navigate("/billing")}
                            >
                              Complete Setup
                            </Button>
                            <Button
                              size="xs"
                              className="flex-1 sm:w-auto md:bg-transparent md:hover:bg-transparent"
                              aria-label="Dismiss payment reminder"
                              onClick={() =>
                                setDismissedBannerForSocietyId(selectedMembership.societyId)
                              }
                            >
                              <IconX className="size-5 hidden md:block text-foreground" />
                              <span className="md:hidden">Dismiss reminder</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <Outlet />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Dialog open={shouldShowTrialBanner && isFeeModalOpen} onOpenChange={setIsFeeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Subscription Setup</DialogTitle>
            <DialogDescription>
              Complete subscription mandate setup to avoid permission blocking after trial expiry.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeeModalOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setIsFeeModalOpen(false);
                navigate("/billing");
              }}
            >
              Go to Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthorizedLayout;

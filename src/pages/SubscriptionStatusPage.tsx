import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  useCancelSubscriptionMutation,
  useSetupSubscriptionMutation,
  useSocietyBillingOverviewQuery,
} from "@/hooks/useAuthApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/dateFormat";

type RazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  notes?: Record<string, string>;
};

type RazorpayCheckout = {
  open: () => void;
};

type RazorpayCheckoutConstructor = new (options: RazorpayCheckoutOptions) => RazorpayCheckout;

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutConstructor;
  }
}

const RAZORPAY_CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
type BadgeTone = "destructive" | "secondary" | "outline" | "default";

const getTransactionStatusVariant = (status: string): BadgeTone => {
  const normalized = status.toUpperCase();
  if (normalized === "SUCCESS") return "default";
  if (normalized === "REFUNDED") return "secondary";
  if (normalized === "FAILED") return "destructive";
  return "outline";
};

const ensureRazorpayCheckout = async () => {
  if (window.Razorpay) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Razorpay")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
};

const SubscriptionStatusPage = () => {
  const [isOpeningMandate, setIsOpeningMandate] = useState(false);
  const [cancelAction, setCancelAction] = useState<"CANCEL_ONLY" | "CANCEL_REFUND" | null>(null);
  const queryClient = useQueryClient();
  const selectedMembership = useAuthSessionStore((state) => state.selectedMembership);
  const setupSubscriptionMutation = useSetupSubscriptionMutation();
  const cancelSubscriptionMutation = useCancelSubscriptionMutation();
  const { data, isLoading } = useSocietyBillingOverviewQuery(
    selectedMembership?.societyId ?? null,
    Boolean(selectedMembership?.societyId),
  );

  const handleMandate = async () => {
    if (!selectedMembership?.societyId) return;
    try {
      setIsOpeningMandate(true);
      await ensureRazorpayCheckout();

      const subscriptionSetup = await setupSubscriptionMutation.mutateAsync(selectedMembership.societyId);
      if (subscriptionSetup.razorpaySubscriptionShortUrl) {
        window.open(subscriptionSetup.razorpaySubscriptionShortUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const RazorpayConstructor = window.Razorpay;
      if (!RazorpayConstructor) {
        throw new Error("Razorpay SDK unavailable");
      }

      const checkout = new RazorpayConstructor({
        key: subscriptionSetup.keyId,
        subscription_id: subscriptionSetup.razorpaySubscriptionId,
        name: selectedMembership.societyName,
        description: "Shridhan subscription mandate setup",
        notes: {
          societyId: selectedMembership.societyId,
          customerId: subscriptionSetup.razorpayCustomerId,
        },
      });
      checkout.open();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to initialize subscription mandate"));
    } finally {
      setIsOpeningMandate(false);
    }
  };

  const handleCancelSubscription = async (refundLatestPayment: boolean) => {
    if (!selectedMembership?.societyId) return;

    try {
      const response = await cancelSubscriptionMutation.mutateAsync({
        societyId: selectedMembership.societyId,
        refundLatestPayment,
      });
      await queryClient.invalidateQueries({
        queryKey: ["society-billing-overview", selectedMembership.societyId],
      });

      if (response.refunded) {
        toast.success("Subscription cancelled and refund initiated successfully.");
      } else {
        toast.success("Subscription cancelled successfully.");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to cancel subscription"));
    }
  };

  const confirmCancelAction = async () => {
    if (!cancelAction) return;
    await handleCancelSubscription(cancelAction === "CANCEL_REFUND");
    setCancelAction(null);
  };

  const setupFeeStatus = data?.setupFee.waived ? "Waived" : data?.setupFee.paid ? "Paid" : "Pending";
  const trialDays = data?.trial.daysRemaining;
  const trialTone: BadgeTone =
    typeof trialDays === "number" && trialDays <= 3
      ? "destructive"
      : typeof trialDays === "number" && trialDays <= 7
        ? "secondary"
        : "outline";

  const subscriptionStatus = data?.subscription?.status ?? "NOT_STARTED";
  const mandateStatus = data?.subscription?.mandateStatus ?? "PENDING";

  const getTrialUiMeta = () => {
    const endAt = data?.trial.endAt ? formatDate(data.trial.endAt) : "N/A";
    const defaultBadge =
      typeof trialDays === "number"
        ? `${Math.max(trialDays, 0)} day(s) left`
        : "Trial status unavailable";

    if (!data) {
      return {
        title: "Trial",
        description: "Track trial period and complete billing steps before expiry.",
        badgeText: "Loading",
        badgeTone: "outline" as BadgeTone,
        endAt,
      };
    }

    if (data.override.enabled) {
      return {
        title: "Trial",
        description: "Developer override is active. Access will continue regardless of billing state.",
        badgeText: "Override enabled",
        badgeTone: "outline" as BadgeTone,
        endAt,
      };
    }

    if (subscriptionStatus === "ACTIVE" || mandateStatus === "ACTIVE") {
      return {
        title: "Trial",
        description: "Mandate is already completed. Subscription is configured for post-trial billing.",
        badgeText: data.trial.isActive ? defaultBadge : "Trial ended",
        badgeTone: data.trial.isActive ? trialTone : ("secondary" as BadgeTone),
        endAt,
      };
    }

    if (data.trial.isActive) {
      return {
        title: "Trial",
        description: "Complete subscription mandate to continue access after trial expiry.",
        badgeText: defaultBadge,
        badgeTone: trialTone,
        endAt,
      };
    }

    return {
      title: "Trial",
      description: "Trial has ended. Mandate setup is required to continue access.",
      badgeText: "Trial ended",
      badgeTone: "destructive" as BadgeTone,
      endAt,
    };
  };

  const trialUi = getTrialUiMeta();

  const getSubscriptionUiMeta = () => {
    if (!data) {
      return {
        title: "Mandate & Subscription",
        description: "Activate recurring billing with mandate setup.",
        statusLabel: "Loading",
        statusTone: "outline" as BadgeTone,
        dateLabel: "Important date",
        dateValue: "N/A",
        buttonText: "Setup UPI Mandate",
        canSetupMandate: true,
      };
    }

    if (data.override.enabled) {
      return {
        title: "Developer Override Active",
        description: "Full access is currently granted by developer override.",
        statusLabel: "OVERRIDE_ENABLED",
        statusTone: "outline" as BadgeTone,
        dateLabel: "Trial ends",
        dateValue: data.trial.endAt ? formatDate(data.trial.endAt) : "N/A",
        buttonText: "Setup Mandate (Optional)",
        canSetupMandate: true,
      };
    }

    if (data.trial.isActive && subscriptionStatus === "NOT_STARTED") {
      return {
        title: "Trial Active - Mandate Pending",
        description: "Dashboard access is available during trial. Complete mandate before trial ends.",
        statusLabel: "TRIAL_ACTIVE",
        statusTone: trialTone,
        dateLabel: "Trial ends",
        dateValue: data.trial.endAt ? formatDate(data.trial.endAt) : "N/A",
        buttonText: "Setup Mandate Before Trial End",
        canSetupMandate: true,
      };
    }

    if (subscriptionStatus === "PENDING_ACTIVATION") {
      return {
        title: "Mandate Authorization Pending",
        description: "Mandate setup is initiated. Complete authorization on Razorpay to activate billing.",
        statusLabel: mandateStatus,
        statusTone: "secondary" as BadgeTone,
        dateLabel: "Trial ends",
        dateValue: data.trial.endAt ? formatDate(data.trial.endAt) : "N/A",
        buttonText: "Open Razorpay to Complete Mandate",
        canSetupMandate: true,
      };
    }

    if (subscriptionStatus === "ACTIVE") {
      return {
        title: "Subscription Active",
        description: "Recurring billing is active. Payments will auto-debit as per plan cycle.",
        statusLabel: "ACTIVE",
        statusTone: "outline" as BadgeTone,
        dateLabel: "Next billing",
        dateValue: data.subscription?.nextBillingAt ? formatDate(data.subscription.nextBillingAt) : "N/A",
        buttonText: "Mandate Already Active",
        canSetupMandate: false,
      };
    }

    if (subscriptionStatus === "PAYMENT_FAILED") {
      return {
        title: "Payment Failed - In Grace Period",
        description: "Last charge failed. Resolve mandate/payment issue to avoid access blockage.",
        statusLabel: "PAYMENT_FAILED",
        statusTone: "destructive" as BadgeTone,
        dateLabel: "Grace ends",
        dateValue: data.subscription?.graceEndDate ? formatDate(data.subscription.graceEndDate) : "N/A",
        buttonText: "Retry Mandate Setup",
        canSetupMandate: true,
      };
    }

    if (subscriptionStatus === "PAUSED") {
      return {
        title: "Subscription Paused",
        description: "Subscription is paused. Re-authorize mandate to restore recurring billing.",
        statusLabel: "PAUSED",
        statusTone: "secondary" as BadgeTone,
        dateLabel: "Trial ended",
        dateValue: data.trial.endAt ? formatDate(data.trial.endAt) : "N/A",
        buttonText: "Re-Setup Mandate",
        canSetupMandate: true,
      };
    }

    if (subscriptionStatus === "CANCELLED") {
      return {
        title: "Subscription Cancelled",
        description: "Subscription is cancelled. Start a new mandate to resume billing access.",
        statusLabel: "CANCELLED",
        statusTone: "destructive" as BadgeTone,
        dateLabel: "Last billed",
        dateValue: data.subscription?.previousBillingAt
          ? formatDate(data.subscription.previousBillingAt)
          : "N/A",
        buttonText: "Setup New Mandate",
        canSetupMandate: true,
      };
    }

    return {
      title: "Subscription Required",
      description: "Trial is over and mandate setup is required to continue access.",
      statusLabel: subscriptionStatus,
      statusTone: "secondary" as BadgeTone,
      dateLabel: "Trial ended",
      dateValue: data.trial.endAt ? formatDate(data.trial.endAt) : "N/A",
      buttonText: "Setup UPI Mandate",
      canSetupMandate: true,
    };
  };

  const subscriptionUi = getSubscriptionUiMeta();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Subscription & Billing
        </h1>
        <p className="text-muted-foreground mt-2">
          Track trial, one-time fee status, mandate status, and payments in one place.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Card key={item}>
              <CardHeader className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-8 w-20 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="border-muted/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{trialUi.title}</CardTitle>
                <CardDescription>Ends at {trialUi.endAt}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={trialUi.badgeTone}>{trialUi.badgeText}</Badge>
                <p className="text-sm text-muted-foreground">{trialUi.description}</p>
              </CardContent>
            </Card>

            <Card className="border-muted/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">One-Time Setup Fee</CardTitle>
                <CardDescription>
                  Amount: {data?.setupFee.amount ?? "0"} {data?.setupFee.enabled ? "INR" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Current status</p>
                  <Badge variant={setupFeeStatus === "Pending" ? "secondary" : "outline"}>
                    {setupFeeStatus}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  One-time fee is charged through the first subscription charge and never billed again.
                </p>
              </CardContent>
            </Card>

            <Card className="border-muted/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{subscriptionUi.title}</CardTitle>
                <CardDescription>{subscriptionUi.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Subscription status</p>
                  <Badge variant={subscriptionUi.statusTone}>{subscriptionUi.statusLabel}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{subscriptionUi.dateLabel}</p>
                  <p className="text-sm font-medium">{subscriptionUi.dateValue}</p>
                </div>
                {subscriptionUi.canSetupMandate ? (
                  <Button onClick={handleMandate} disabled={isOpeningMandate}>
                    {isOpeningMandate ? "Opening Razorpay..." : subscriptionUi.buttonText}
                  </Button>
                ) : null}
                {data?.subscription && data.subscription.status !== "CANCELLED" ? (
                  <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={cancelSubscriptionMutation.isPending}
                      onClick={() => setCancelAction("CANCEL_ONLY")}
                    >
                      {cancelSubscriptionMutation.isPending
                        ? "Cancelling..."
                        : "Cancel Subscription Only"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={cancelSubscriptionMutation.isPending}
                      onClick={() => setCancelAction("CANCEL_REFUND")}
                    >
                      {cancelSubscriptionMutation.isPending
                        ? "Processing Refund..."
                        : "Cancel Subscription + Refund"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="border-muted/70 shadow-sm">
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>Recent setup fee and subscription transactions.</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.transactions.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Billing Date</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Payment ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactions.map((transaction) => (
                      <TableRow
                        key={transaction.id}
                        className={transaction.status === "REFUNDED" ? "bg-amber-50/40 dark:bg-amber-500/5" : ""}
                      >
                        <TableCell className="font-medium">{transaction.amount}</TableCell>
                        <TableCell>
                          <Badge variant={getTransactionStatusVariant(transaction.status)}>
                            {transaction.status === "REFUNDED" ? "REFUNDED (Amount Reversed)" : transaction.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(transaction.billingDate)}</TableCell>
                        <TableCell>
                          {transaction.paymentDate ? formatDate(transaction.paymentDate) : "N/A"}
                        </TableCell>
                        <TableCell>{transaction.paymentMethod ?? "N/A"}</TableCell>
                        <TableCell className="max-w-[260px] truncate" title={transaction.razorpayPaymentId ?? "N/A"}>
                          {transaction.razorpayPaymentId ?? "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <AlertDialog open={cancelAction !== null} onOpenChange={(open) => !open && setCancelAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelAction === "CANCEL_REFUND"
                ? "Cancel Subscription and Refund"
                : "Cancel Subscription"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelAction === "CANCEL_REFUND"
                ? "This will cancel recurring billing immediately and attempt to refund the latest successful payment. If no refundable payment exists, subscription will still be cancelled."
                : "This will cancel recurring billing immediately. No payment refund will be initiated."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelSubscriptionMutation.isPending}>Keep Active</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmCancelAction();
              }}
              disabled={cancelSubscriptionMutation.isPending}
            >
              {cancelSubscriptionMutation.isPending
                ? "Please wait..."
                : cancelAction === "CANCEL_REFUND"
                  ? "Confirm Cancel + Refund"
                  : "Confirm Cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SubscriptionStatusPage;

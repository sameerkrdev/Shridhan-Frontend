import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCreateSetupFeeLinkMutation,
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
  const selectedSociety = useAuthSessionStore((state) => state.selectedMembership);
  const setupSubscriptionMutation = useSetupSubscriptionMutation();
  const createSetupFeeLinkMutation = useCreateSetupFeeLinkMutation();
  const { data, isLoading, refetch } = useSocietyBillingOverviewQuery(
    selectedSociety?.societyId ?? null,
    Boolean(selectedSociety?.societyId),
  );

  const handleSetupFeePayment = async () => {
    if (!selectedSociety?.societyId) return;
    try {
      const result = await createSetupFeeLinkMutation.mutateAsync(selectedSociety.societyId);
      if (result.setupFeePaid || result.setupFeeWaived) {
        toast.success("Setup fee already completed.");
        await refetch();
        return;
      }
      if (result.paymentLinkUrl) {
        window.location.href = result.paymentLinkUrl;
        return;
      }
      toast.error("Setup fee payment link is unavailable");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to initiate setup fee payment"));
    }
  };

  const handleMandate = async () => {
    if (!selectedSociety?.societyId) return;
    try {
      setIsOpeningMandate(true);
      await ensureRazorpayCheckout();

      const subscriptionSetup = await setupSubscriptionMutation.mutateAsync(selectedSociety.societyId);
      const RazorpayConstructor = window.Razorpay;
      if (!RazorpayConstructor) {
        throw new Error("Razorpay SDK unavailable");
      }

      const checkout = new RazorpayConstructor({
        key: subscriptionSetup.keyId,
        subscription_id: subscriptionSetup.razorpaySubscriptionId,
        name: selectedSociety.societyName,
        description: "Shridhan subscription mandate setup",
        notes: {
          societyId: selectedSociety.societyId,
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

  const setupFeeStatus = data?.setupFee.waived ? "Waived" : data?.setupFee.paid ? "Paid" : "Pending";
  const trialDays = data?.trial.daysRemaining;
  const trialTone =
    typeof trialDays === "number" && trialDays <= 3
      ? "destructive"
      : typeof trialDays === "number" && trialDays <= 7
        ? "secondary"
        : "outline";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Subscription & Billing
        </h1>
        <p className="text-muted-foreground mt-2">
          Track trial, setup fee, mandate status, and payments in one place.
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
                <CardTitle className="text-base">Trial</CardTitle>
                <CardDescription>Ends at {formatDate(data?.trial.endAt)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge variant={trialTone}>
                  {typeof trialDays === "number" ? `${trialDays} day(s) left` : "N/A"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Complete setup fee to continue access after trial expiry.
                </p>
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
                {!data?.setupFee.paid && !data?.setupFee.waived ? (
                  <Button onClick={handleSetupFeePayment} disabled={createSetupFeeLinkMutation.isPending}>
                    {createSetupFeeLinkMutation.isPending ? "Preparing payment link..." : "Pay One-Time Fee"}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Setup fee is complete. You can proceed with mandate setup.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-muted/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mandate & Subscription</CardTitle>
                <CardDescription>Activate recurring billing after setup fee completion.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Subscription status</p>
                  <Badge variant="outline">{data?.subscription?.status ?? "Not started"}</Badge>
                </div>
                <Button
                  onClick={handleMandate}
                  disabled={!(data?.setupFee.paid || data?.setupFee.waived) || isOpeningMandate}
                >
                  {isOpeningMandate ? "Opening Razorpay..." : "Setup UPI Mandate"}
                </Button>
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
                <div className="space-y-2">
                  {data.transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm md:grid-cols-4"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-medium">{transaction.amount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant="outline">{transaction.status}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Billing date</p>
                        <p className="font-medium">{formatDate(transaction.billingDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Payment id</p>
                        <p className="font-medium break-all">{transaction.razorpayPaymentId ?? "N/A"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatusPage;

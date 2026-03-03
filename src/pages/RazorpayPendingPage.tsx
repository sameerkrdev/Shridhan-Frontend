import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreateSetupFeeLinkMutation, useSetupSubscriptionMutation } from "@/hooks/useAuthApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { getApiErrorMessage } from "@/lib/apiError";

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

const RazorpayPendingPage = () => {
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [setupFeeStepCompleted, setSetupFeeStepCompleted] = useState(false);
  const createSetupFeeLinkMutation = useCreateSetupFeeLinkMutation();
  const setupSubscriptionMutation = useSetupSubscriptionMutation();
  const selectedSociety = useAuthSessionStore((state) => state.selectedMembership);

  const onPaySetupFee = async () => {
    if (!selectedSociety?.societyId) {
      toast.error("No society selected");
      return;
    }

    try {
      const setupFee = await createSetupFeeLinkMutation.mutateAsync(selectedSociety.societyId);
      if (setupFee.setupFeePaid || setupFee.setupFeeWaived) {
        setSetupFeeStepCompleted(true);
        toast.success("Setup fee already satisfied. You can continue.");
        return;
      }

      if (!setupFee.paymentLinkUrl) {
        throw new Error("Setup fee payment link unavailable");
      }

      window.location.href = setupFee.paymentLinkUrl;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to create setup fee payment link"));
    }
  };

  const onCompleteMandate = async () => {
    if (!selectedSociety?.societyId) {
      toast.error("No society selected");
      return;
    }

    try {
      setIsOpeningCheckout(true);
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
      toast.success("Mandate initialized. Subscription activates after webhook confirmation.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to initialize Razorpay mandate"));
    } finally {
      setIsOpeningCheckout(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold">Razorpay Setup Pending</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Complete setup fee first, then configure UPI Autopay mandate.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          onClick={onPaySetupFee}
          disabled={createSetupFeeLinkMutation.isPending}
        >
          {createSetupFeeLinkMutation.isPending ? "Preparing payment link..." : "Pay one-time setup fee"}
        </Button>
        <Button
          type="button"
          className="mt-6 w-full"
          onClick={onCompleteMandate}
          disabled={
            !setupFeeStepCompleted || isOpeningCheckout || setupSubscriptionMutation.isPending
          }
        >
          {isOpeningCheckout || setupSubscriptionMutation.isPending
            ? "Opening Razorpay..."
            : "Complete UPI Autopay Mandate"}
        </Button>
      </div>
    </div>
  );
};

export default RazorpayPendingPage;

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSetupSubscriptionMutation } from "@/hooks/useAuthApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { getApiErrorMessage } from "@/lib/apiError";
import { useLocation } from "react-router";

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
  const setupSubscriptionMutation = useSetupSubscriptionMutation();
  const selectedMembership = useAuthSessionStore((state) => state.selectedMembership);
  const location = useLocation();
  const hasAutoOpenedRef = useRef(false);
  const mandateSetupFromState = (location.state as { mandateSetup?: null | {
    keyId: string;
    razorpaySubscriptionId: string;
    razorpayCustomerId: string;
    status: string;
    razorpaySubscriptionShortUrl: string | null;
  } } | null)?.mandateSetup;

  const openCheckout = useCallback(
    async (subscriptionSetup?: {
      keyId: string;
      razorpaySubscriptionId: string;
      razorpayCustomerId: string;
      status: string;
      razorpaySubscriptionShortUrl: string | null;
    }) => {
      if (!selectedMembership?.societyId) {
        toast.error("No society selected");
        return;
      }

      try {
        setIsOpeningCheckout(true);
        await ensureRazorpayCheckout();

        const setup =
          subscriptionSetup ??
          (await setupSubscriptionMutation.mutateAsync(selectedMembership.societyId));

        if (setup.razorpaySubscriptionShortUrl) {
          window.open(setup.razorpaySubscriptionShortUrl, "_blank", "noopener,noreferrer");
          return;
        }

        const RazorpayConstructor = window.Razorpay;

        if (!RazorpayConstructor) {
          throw new Error("Razorpay SDK unavailable");
        }

        const checkout = new RazorpayConstructor({
          key: setup.keyId,
          subscription_id: setup.razorpaySubscriptionId,
          name: selectedMembership.societyName,
          description: "Shridhan subscription mandate setup",
          notes: {
            societyId: selectedMembership.societyId,
            customerId: setup.razorpayCustomerId,
          },
        });

        checkout.open();
        toast.success("Mandate initialized. Subscription activates after webhook confirmation.");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Unable to initialize Razorpay mandate"));
      } finally {
        setIsOpeningCheckout(false);
      }
    },
    [selectedMembership, setupSubscriptionMutation],
  );

  useEffect(() => {
    if (!mandateSetupFromState || hasAutoOpenedRef.current) {
      return;
    }
    hasAutoOpenedRef.current = true;
    void openCheckout(mandateSetupFromState);
  }, [mandateSetupFromState, openCheckout]);

  return (
    <div className="min-h-svh flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold">Razorpay Setup Pending</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Configure UPI Autopay mandate to activate subscription billing.
        </p>
        <Button
          type="button"
          className="mt-6 w-full"
          onClick={() => void openCheckout()}
          disabled={isOpeningCheckout || setupSubscriptionMutation.isPending}
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

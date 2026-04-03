import React from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useLocation, useNavigate } from "react-router";
import {
  useCheckUserExistsMutation,
  useLoginMutation,
  useSendLoginOtpMutation,
  useVerifyLoginOtpMutation,
} from "@/hooks/useAuthApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { getApiErrorMessage } from "@/lib/apiError";
import { readRedirectFromSearch, setPendingPostLoginRedirect } from "@/lib/postLoginRedirect";

// -------------------- VALIDATION SCHEMAS --------------------
const phoneSchema = z.object({
  phone: z.string().min(10, "Enter valid phone number").max(10, "Enter 10 digits"),
});

const otpSchema = z.object({
  otp: z.string().min(6, "OTP must be 6 digits"),
});

// -------------------- MAIN COMPONENT --------------------
export function LoginFormFields() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthPayload = useAuthSessionStore((state) => state.setAuthPayload);
  const [step, setStep] = React.useState<"login" | "otp">("login");
  const [phone, setPhone] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const checkMemberExistsMutation = useCheckUserExistsMutation();
  const loginMutation = useLoginMutation();
  const sendLoginOtpMutation = useSendLoginOtpMutation();
  const verifyLoginOtpMutation = useVerifyLoginOtpMutation();

  // Step 1: Phone + society form
  const loginForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: "",
    },
  });

  // Step 2: OTP Form
  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });
  const otpValue = useWatch({
    control: otpForm.control,
    name: "otp",
  });

  // -------------------- SEND OTP --------------------
  async function sendOtp(values: z.infer<typeof phoneSchema>) {
    setPhone(values.phone);
    setFormError(null);
    try {
      const exists = await checkMemberExistsMutation.mutateAsync({ phone: values.phone });
      if (!exists) {
        const message = "Phone number is not registered";
        setFormError(message);
        toast.error(message);
        return;
      }

      await sendLoginOtpMutation.mutateAsync({ phone: values.phone });
      toast.success("OTP Sent", {
        description: `A 6-digit verification code was sent to ${values.phone}.`,
      });
      setStep("otp");
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to send OTP");
      setFormError(message);
      toast.error(message);
    }
  }

  // -------------------- VERIFY OTP --------------------
  async function verifyOtp(values: z.infer<typeof otpSchema>) {
    setFormError(null);
    try {
      await verifyLoginOtpMutation.mutateAsync({ phone, otp: values.otp });
      const payload = await loginMutation.mutateAsync({ phone });
      setAuthPayload(payload);

      toast.success("OTP Verified", {
        description: "Welcome back to Shridhan!",
      });

      console.log("Logged in:", { phone, otp: values.otp });
      const pendingRedirect = readRedirectFromSearch(location.search);
      if (pendingRedirect) {
        setPendingPostLoginRedirect(pendingRedirect);
      }
      navigate("/society-selector");
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to verify OTP");
      setFormError(message);
      toast.error(message);
    }
  }

  async function resendOtp() {
    setFormError(null);
    try {
      await sendLoginOtpMutation.mutateAsync({ phone });
      toast("OTP Resent", {
        description: `A new code has been sent to ${phone}`,
      });
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to resend OTP");
      setFormError(message);
      toast.error(message);
    }
  }

  // ===================================================================
  // STEP 1 — PHONE
  // ===================================================================
  if (step === "login")
    return (
      <form onSubmit={loginForm.handleSubmit(sendOtp)}>
        <FieldGroup className="gap-2">
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          {/* PHONE */}
          <Field>
            <FieldLabel htmlFor="phone">
              Phone Number <span className="text-red-500">*</span>
            </FieldLabel>
            <Input
              id="phone"
              placeholder="Enter your Phone Number"
              {...loginForm.register("phone")}
            />
            <p className="text-red-500 text-sm">{loginForm.formState.errors.phone?.message}</p>
          </Field>

          {/* SEND OTP */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              loginMutation.isPending ||
              sendLoginOtpMutation.isPending ||
              checkMemberExistsMutation.isPending
            }
          >
            {checkMemberExistsMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Checking...
              </span>
            ) : sendLoginOtpMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Sending OTP...
              </span>
            ) : (
              "Send OTP"
            )}
          </Button>
        </FieldGroup>
      </form>
    );

  // ===================================================================
  // STEP 2 — OTP VERIFICATION
  // ===================================================================
  return (
    <form onSubmit={otpForm.handleSubmit(verifyOtp)}>
      <FieldGroup>
        {formError && <p className="text-red-500 text-sm text-center">{formError}</p>}
        <div className="flex flex-col items-center justify-center">
          <FieldDescription>
            A 6-digit code has been sent to <span className="font-semibold"> {phone}</span>
          </FieldDescription>
        </div>

        <Field>
          {/* <FieldLabel htmlFor="phone">One-Time Password</FieldLabel> */}
          <div className="flex flex-col gap-2 items-center justify-center">
            <InputOTP
              maxLength={6}
              value={otpValue}
              onChange={(value) => otpForm.setValue("otp", value)}
              containerClassName="gap-4"
            >
              <InputOTPGroup className="gap-2.5">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>

              <InputOTPSeparator />

              <InputOTPGroup className="gap-2.5">
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-red-500 text-sm">{otpForm.formState.errors.otp?.message}</p>
          </div>
          <FieldDescription className="text-center text-xs">
            OTP <span className="text-red-500">*</span>
          </FieldDescription>

          <FieldDescription className="text-center">
            Didn’t receive it?{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void resendOtp()}
              disabled={sendLoginOtpMutation.isPending}
            >
              {sendLoginOtpMutation.isPending ? "Resending..." : "Resend"}
            </button>
          </FieldDescription>
        </Field>

        <Button
          type="submit"
          className="w-full"
          disabled={verifyLoginOtpMutation.isPending || loginMutation.isPending}
        >
          {verifyLoginOtpMutation.isPending || loginMutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Verifying...
            </span>
          ) : (
            "Verify"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}

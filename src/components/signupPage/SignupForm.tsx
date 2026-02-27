"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useNavigate } from "react-router";
import {
  useSendSignupEmailOtpMutation,
  useSendSignupPhoneOtpMutation,
  useSignupMutation,
  useVerifySignupEmailOtpMutation,
  useVerifySignupPhoneOtpMutation,
} from "@/hooks/useAuthApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { getApiErrorMessage } from "@/lib/apiError";

// --------------------- SCHEMA ---------------------
const SignupSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  phone: z.string().min(10, "Phone is required"),
  email: z.string().email("Invalid email"),
  phoneOtp: z.string().length(6, "Enter 6 digit OTP").optional(),
  emailOtp: z.string().length(6, "Enter 6 digit OTP").optional(),
});

type SignupType = z.infer<typeof SignupSchema>;

const SignupForm = () => {
  const navigate = useNavigate();
  const signupMutation = useSignupMutation();
  const sendPhoneOtpMutation = useSendSignupPhoneOtpMutation();
  const verifyPhoneOtpMutation = useVerifySignupPhoneOtpMutation();
  const sendEmailOtpMutation = useSendSignupEmailOtpMutation();
  const verifyEmailOtpMutation = useVerifySignupEmailOtpMutation();
  const setAuthPayload = useAuthSessionStore((state) => state.setAuthPayload);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<SignupType>({
    resolver: zodResolver(SignupSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      phoneOtp: "",
      emailOtp: "",
    },
  });

  // Watch form values
  const phone = useWatch({ control, name: "phone" });
  const email = useWatch({ control, name: "email" });
  const phoneOtp = useWatch({ control, name: "phoneOtp" });
  const emailOtp = useWatch({ control, name: "emailOtp" });

  // ---------------- OTP STATES ----------------
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // ---------------- HANDLERS ----------------
  const sendPhoneOtp = async () => {
    if (!phone) return toast.error("Enter phone first");
    setFormError(null);
    try {
      await sendPhoneOtpMutation.mutateAsync({ phone });
      setPhoneOtpSent(true);
      toast.success("OTP sent to phone");
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to send phone OTP");
      setFormError(message);
      toast.error(message);
    }
  };

  const verifyPhoneOtp = async () => {
    if (phoneOtp?.length !== 6) return toast.error("Enter valid OTP");
    if (!phoneOtp) return toast.error("Enter valid OTP");
    setFormError(null);
    try {
      await verifyPhoneOtpMutation.mutateAsync({ phone, otp: phoneOtp });
      setPhoneVerified(true);
      toast.success("Phone verified");
    } catch (error) {
      const message = getApiErrorMessage(error, "Phone OTP verification failed");
      setFormError(message);
      toast.error(message);
    }
  };

  const sendEmailOtp = async () => {
    if (!email) return toast.error("Enter email first");
    setFormError(null);
    try {
      await sendEmailOtpMutation.mutateAsync({ email });
      setEmailOtpSent(true);
      toast.success("OTP sent to email");
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to send email OTP");
      setFormError(message);
      toast.error(message);
    }
  };

  const verifyEmailOtp = async () => {
    if (emailOtp?.length !== 6) return toast.error("Enter valid OTP");
    if (!emailOtp) return toast.error("Enter valid OTP");
    setFormError(null);
    try {
      await verifyEmailOtpMutation.mutateAsync({ email, otp: emailOtp });
      setEmailVerified(true);
      toast.success("Email verified");
    } catch (error) {
      const message = getApiErrorMessage(error, "Email OTP verification failed");
      setFormError(message);
      toast.error(message);
    }
  };

  const onSubmit = async (data: SignupType) => {
    if (!phoneVerified || !emailVerified) return toast.error("Verify both phone & email");
    setFormError(null);

    try {
      const payload = await signupMutation.mutateAsync({
        name: data.name,
        phone: data.phone,
        email: data.email,
        role: "SUPER_ADMIN",
      });
      setAuthPayload(payload);

      toast.success("Account created successfully");
      navigate(payload.routeIntent === "CREATE_NEW_SOCIETY" ? "/onboarding" : "/society-selector");
    } catch (error) {
      const message = getApiErrorMessage(error, "Unable to create account");
      setFormError(message);
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup className="gap-4">
        {formError && <p className="text-red-500 text-sm">{formError}</p>}
        {/* NAME */}
        <Field>
          <FieldLabel>
            Name <span className="text-red-500">*</span>
          </FieldLabel>
          <Input placeholder="Enter your name" {...register("name")} />
          {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
        </Field>

        {/* PHONE */}
        <Field>
          <FieldLabel>
            Phone Number <span className="text-red-500">*</span>
          </FieldLabel>
          <div className="flex gap-2">
            <Input placeholder="Enter phone" disabled={phoneVerified} {...register("phone")} />

            {!phoneVerified && !phoneOtpSent && (
              <Button type="button" onClick={() => void sendPhoneOtp()} disabled={sendPhoneOtpMutation.isPending}>
                {sendPhoneOtpMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  "Send OTP"
                )}
              </Button>
            )}

            {phoneVerified && (
              <span className="text-green-600 text-sm pt-2 whitespace-nowrap">Verified ✔</span>
            )}
          </div>

          {phoneOtpSent && !phoneVerified && (
            <div className="space-y-2 pl-1">
              <InputOTP
                maxLength={6}
                value={phoneOtp}
                onChange={(val) => setValue("phoneOtp", val)}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <div className="flex gap-4 items-center">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void verifyPhoneOtp()}
                  disabled={verifyPhoneOtpMutation.isPending}
                >
                  {verifyPhoneOtpMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>

                <FieldDescription className="text-xs">
                  Didn’t receive?{" "}
                  <button
                    type="button"
                    className="underline text-xs"
                    onClick={() => void sendPhoneOtp()}
                    disabled={sendPhoneOtpMutation.isPending}
                  >
                    {sendPhoneOtpMutation.isPending ? "Resending..." : "Resend"}
                  </button>
                </FieldDescription>
              </div>
            </div>
          )}
        </Field>

        {/* EMAIL */}
        <Field>
          <FieldLabel>
            Email <span className="text-red-500">*</span>
          </FieldLabel>
          <div className="flex gap-2">
            <Input placeholder="Enter email" disabled={emailVerified} {...register("email")} />

            {!emailVerified && !emailOtpSent && (
              <Button type="button" onClick={() => void sendEmailOtp()} disabled={sendEmailOtpMutation.isPending}>
                {sendEmailOtpMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  "Send OTP"
                )}
              </Button>
            )}

            {emailVerified && (
              <span className="text-green-600 text-sm pt-2 whitespace-nowrap">Verified ✔</span>
            )}
          </div>

          {emailOtpSent && !emailVerified && (
            <div className="space-y-2 pl-1">
              <InputOTP
                maxLength={6}
                value={emailOtp}
                onChange={(val) => setValue("emailOtp", val)}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <div className="flex gap-4 items-center">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void verifyEmailOtp()}
                  disabled={verifyEmailOtpMutation.isPending}
                >
                  {verifyEmailOtpMutation.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>
                <FieldDescription className="text-xs">
                  Didn’t receive?{" "}
                  <button
                    type="button"
                    className="underline text-xs"
                    onClick={() => void sendEmailOtp()}
                    disabled={sendEmailOtpMutation.isPending}
                  >
                    {sendEmailOtpMutation.isPending ? "Resending..." : "Resend"}
                  </button>
                </FieldDescription>
              </div>
            </div>
          )}
        </Field>

        {/* SUBMIT */}
        <Button
          type="submit"
          disabled={!phoneVerified || !emailVerified || signupMutation.isPending}
          className="w-full"
        >
          {signupMutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Creating Account...
            </span>
          ) : (
            "Create Account"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
};

export default SignupForm;

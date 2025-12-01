"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useNavigate } from "react-router";

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

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // ---------------- HANDLERS ----------------
  const sendPhoneOtp = () => {
    if (!phone) return toast.error("Enter phone first");
    setPhoneOtpSent(true);
    toast.success("OTP sent to phone");
  };

  const verifyPhoneOtp = () => {
    if (phoneOtp?.length !== 6) return toast.error("Enter valid OTP");
    setPhoneVerified(true);
    toast.success("Phone verified");
  };

  const sendEmailOtp = () => {
    if (!email) return toast.error("Enter email first");
    setEmailOtpSent(true);
    toast.success("OTP sent to email");
  };

  const verifyEmailOtp = () => {
    if (emailOtp?.length !== 6) return toast.error("Enter valid OTP");
    setEmailVerified(true);
    toast.success("Email verified");
  };

  const onSubmit = (data: SignupType) => {
    if (!phoneVerified || !emailVerified) return toast.error("Verify both phone & email");

    console.log("FINAL SUBMIT:", data);
    toast.success("Account created successfully");

    navigate("/onboarding");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup className="gap-4">
        {/* NAME */}
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input placeholder="Enter your name" {...register("name")} />
          {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
        </Field>

        {/* PHONE */}
        <Field>
          <FieldLabel>Phone Number</FieldLabel>
          <div className="flex gap-2">
            <Input placeholder="Enter phone" disabled={phoneVerified} {...register("phone")} />

            {!phoneVerified && !phoneOtpSent && (
              <Button type="button" onClick={sendPhoneOtp}>
                Send OTP
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
                <Button type="button" size="sm" onClick={verifyPhoneOtp}>
                  Verify OTP
                </Button>

                <FieldDescription className="text-xs">
                  Didn’t receive? <button className="underline text-xs">Resend</button>
                </FieldDescription>
              </div>
            </div>
          )}
        </Field>

        {/* EMAIL */}
        <Field>
          <FieldLabel>Email</FieldLabel>
          <div className="flex gap-2">
            <Input placeholder="Enter email" disabled={emailVerified} {...register("email")} />

            {!emailVerified && !emailOtpSent && (
              <Button type="button" onClick={sendEmailOtp}>
                Send OTP
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
                <Button type="button" size="sm" onClick={verifyEmailOtp}>
                  Verify OTP
                </Button>
                <FieldDescription className="text-xs">
                  Didn’t receive? <button className="underline text-xs">Resend</button>
                </FieldDescription>
              </div>
            </div>
          )}
        </Field>

        {/* SUBMIT */}
        <Button type="submit" disabled={!phoneVerified || !emailVerified} className="w-full">
          Create Account
        </Button>
      </FieldGroup>
    </form>
  );
};

export default SignupForm;

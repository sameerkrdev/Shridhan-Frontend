import React from "react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSingleSelectAsync } from "@/components/ui/searchable-single-select";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useNavigate } from "react-router";

// -------------------- VALIDATION SCHEMAS --------------------
const phoneSchema = z.object({
  phone: z.string().min(10, "Enter valid phone number").max(10, "Enter 10 digits"),
  society: z.string().min(1, "Select your society"),
});

const otpSchema = z.object({
  otp: z.string().min(6, "OTP must be 6 digits"),
});

// -------------------- SOCIETY LIST --------------------
const societyList = [
  { value: "maharashtra-credit-cooperative", label: "Maharashtra Credit Cooperative Society" },
  { value: "sahakar-mitra-credit", label: "Sahakar Mitra Credit Society" },
  { value: "janseva-multistate-credit", label: "Janseva Multistate Credit Society" },
  { value: "bharat-bhushan-nagrik-credit", label: "Bharat Bhushan Nagrik Sahkari Credit Society" },
  { value: "pragati-credit-society", label: "Pragati Credit Cooperative Society" },
  { value: "navjeevan-seva-samiti", label: "Navjeevan Seva Samiti" },
  { value: "gramseva-service-society", label: "Gramseva Service Society" },
  { value: "lokhit-seva-sanstha", label: "Lokhit Seva Sanstha" },
  { value: "samaj-kalyan-seva", label: "Samaj Kalyan Seva Society" },
  { value: "sarvodaya-seva-sangh", label: "Sarvodaya Seva Sangh" },
];

// -------------------- MAIN COMPONENT --------------------
export function LoginFormFields() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<"login" | "otp">("login");
  const [phone, setPhone] = React.useState("");

  // Step 1: Phone + society form
  const loginForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: "",
      society: "",
    },
  });

  const societyValue = useWatch({
    control: loginForm.control,
    name: "society",
  });

  // Step 2: OTP Form
  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  async function searchSocieties(query: string) {
    if (!query) return societyList;
    return societyList.filter((x) => x.label.toLowerCase().includes(query.toLowerCase()));
  }

  // -------------------- SEND OTP --------------------
  function sendOtp(values: z.infer<typeof phoneSchema>) {
    setPhone(values.phone);

    toast.success("OTP Sent", {
      description: `A 6-digit verification code was sent to ${values.phone}.`,
    });

    setStep("otp");
  }

  // -------------------- VERIFY OTP --------------------
  function verifyOtp(values: z.infer<typeof otpSchema>) {
    toast.success("OTP Verified", {
      description: "Welcome back to Shridhan!",
    });

    console.log("Logged in:", { phone, societyValue, otp: values.otp });
    navigate("/");
  }

  // ===================================================================
  // STEP 1 — PHONE + SOCIETY
  // ===================================================================
  if (step === "login")
    return (
      <form onSubmit={loginForm.handleSubmit(sendOtp)}>
        <FieldGroup className="gap-2">
          {/* PHONE */}
          <Field>
            <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
            <Input
              id="phone"
              placeholder="Enter your Phone Number"
              {...loginForm.register("phone")}
            />
            <p className="text-red-500 text-sm">{loginForm.formState.errors.phone?.message}</p>
          </Field>

          {/* SOCIETY SELECT */}
          <Field>
            <FieldLabel>Society</FieldLabel>
            <SearchableSingleSelectAsync
              value={societyValue}
              onChange={(v) => loginForm.setValue("society", v)}
              onSearch={searchSocieties}
              placeholder="Select your society"
            />
            <p className="text-red-500 text-sm">{loginForm.formState.errors.society?.message}</p>
          </Field>

          {/* SEND OTP */}
          <Button type="submit" className="w-full">
            Send OTP
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
        <div className="flex flex-col items-center justify-center">
          <FieldDescription>
            A 6-digit code has been sent to <span className="font-semibold"> {phone}</span>
          </FieldDescription>
        </div>

        <Field>
          {/* <FieldLabel htmlFor="phone">One-Time Password</FieldLabel> */}
          <div className="flex flex-col gap-2 items-center justify-center">
            <InputOTP maxLength={6} {...otpForm.register("otp")} containerClassName="gap-4">
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

          <FieldDescription className="text-center">
            Didn’t receive it?{" "}
            <button
              type="button"
              className="underline"
              onClick={() =>
                toast("OTP Resent", {
                  description: `A new code has been sent to ${phone}`,
                })
              }
            >
              Resend
            </button>
          </FieldDescription>
        </Field>

        <Button type="submit" className="w-full">
          Verify
        </Button>
      </FieldGroup>
    </form>
  );
}

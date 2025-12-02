import OnboardingForm from "@/components/onboardingPage/OnboardingForm";
import { FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { GalleryVerticalEnd } from "lucide-react";

// import { SignupForm } from "@/components/signup-form";

export default function OnboardingPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className={cn("flex flex-col gap-6")}>
          {/* HEADER */}
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="/" className="flex items-center gap-2 font-medium">
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <div className="font-bold text-3xl">Shridhan</div>
            </a>

            {/* <h1 className="text-xl font-bold">Welcome to Shridhan</h1>
            <FieldDescription>
              Don&apos;t have an account? <a href="#">Sign up</a>
            </FieldDescription> */}
          </div>

          <h2 className="font-semibold text-xl">Society Details</h2>

          {/* FORM FIELDS */}
          <OnboardingForm />

          {/* FOOTER */}
          <FieldDescription className="px-6 text-center">
            By clicking continue, you agree to our <a href="#">Terms of Service</a> and{" "}
            <a href="#">Privacy Policy</a>.
          </FieldDescription>
        </div>
      </div>
    </div>
  );
}

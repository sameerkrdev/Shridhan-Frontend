import SignupForm from "@/components/signupPage/SignupForm";
import { FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { GalleryVerticalEnd } from "lucide-react";
import { Link } from "react-router";

const SignupPage = () => {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Shridhan
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <div className={cn("flex flex-col gap-6")}>
              {/* HEADER */}
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">Create your account</h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    Fill in the form below to create your account
                  </p>
                </div>
              </div>

              {/* FORM FIELDS */}
              <SignupForm />

              {/* FOOTER */}
              <FieldDescription className="px-6 text-center">
                Already have an account? <Link to="/login">Login</Link>
              </FieldDescription>

              <FieldDescription className="px-6 text-center">
                By clicking continue, you agree to our <a href="#">Terms of Service</a> and{" "}
                <a href="#">Privacy Policy</a>.
              </FieldDescription>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="https://ui.shadcn.com/placeholder.svg"
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
};

export default SignupPage;

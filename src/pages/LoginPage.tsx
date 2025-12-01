import { LoginFormFields } from "@/components/loginPage/LoginFormFields";
import { FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { GalleryVerticalEnd } from "lucide-react";

const LoginPage = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className={cn("flex flex-col gap-6", className)} {...props}>
          {/* HEADER */}
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="#" className="flex flex-col items-center gap-2 font-medium">
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <span className="sr-only">Shridhan</span>
            </a>

            <h1 className="text-xl font-bold">Welcome to Shridhan</h1>
            <FieldDescription>
              Don&apos;t have an account? <a href="#">Sign up</a>
            </FieldDescription>
          </div>

          {/* FORM FIELDS */}
          <LoginFormFields />

          {/* FOOTER */}
          <FieldDescription className="px-6 text-center">
            By clicking continue, you agree to our <a href="#">Terms of Service</a> and{" "}
            <a href="#">Privacy Policy</a>.
          </FieldDescription>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

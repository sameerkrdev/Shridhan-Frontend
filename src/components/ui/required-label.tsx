import type { ComponentProps } from "react";
import { Label } from "@/components/ui/label";

interface RequiredLabelProps extends ComponentProps<typeof Label> {
  required?: boolean;
}

export const RequiredLabel = ({ children, required = true, ...props }: RequiredLabelProps) => {
  return (
    <Label {...props}>
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </Label>
  );
};

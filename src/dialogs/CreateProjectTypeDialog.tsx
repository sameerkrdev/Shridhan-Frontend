import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateProjectTypeMutation } from "@/hooks/useFixedDepositApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MaturityCalculationMethod } from "@/lib/fixedDepositApi";

const schema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    duration: z.number().int().min(1, "Duration must be at least 1 month").max(360),
    minimumAmount: z.number().min(1, "Minimum amount must be greater than 0").max(100000000),
    maturityCalculationMethod: z.enum(["PER_RS_100", "MULTIPLE_OF_PRINCIPAL"]),
    maturityValue: z.number().refine((v) => !Number.isNaN(v), "Enter a valid number"),
  })
  .superRefine((data, ctx) => {
    if (data.maturityCalculationMethod === "PER_RS_100") {
      if (data.maturityValue < 1 || data.maturityValue > 100000) {
        ctx.addIssue({
          code: "custom",
          path: ["maturityValue"],
          message: "Return per Rs.100 must be between 1 and 100000",
        });
      }
    } else if (data.maturityValue < 0.1 || data.maturityValue > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["maturityValue"],
        message: "Maturity multiple must be between 0.1 and 100",
      });
    }
  });

type FormData = z.infer<typeof schema>;

interface CreateProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
}

export const CreateProjectTypeDialog = ({
  open,
  onOpenChange,
  societyId,
}: CreateProjectTypeDialogProps) => {
  const mutation = useCreateProjectTypeMutation(societyId);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      duration: undefined,
      minimumAmount: undefined,
      maturityCalculationMethod: "PER_RS_100",
      maturityValue: undefined,
    },
  });

  const maturityCalculationMethod =
    useWatch({ control, name: "maturityCalculationMethod" }) ?? "PER_RS_100";

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync({
        name: values.name,
        duration: values.duration,
        minimumAmount: values.minimumAmount,
        maturityCalculationMethod: values.maturityCalculationMethod,
        maturityValue: values.maturityValue,
      });
      toast.success("Project type created");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create project type"));
    }
  };

  const valueLabel =
    maturityCalculationMethod === "PER_RS_100"
      ? "Return per Rs.100"
      : "Maturity multiple (× principal)";
  const valuePlaceholder = maturityCalculationMethod === "PER_RS_100" ? "e.g. 115" : "e.g. 1.2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create Project Type</DialogTitle>
          <DialogDescription>Define a fixed deposit plan configuration.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel htmlFor="fd-project-name">Name</RequiredLabel>
            <Input id="fd-project-name" placeholder="FD 12 Month" {...register("name")} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="fd-project-duration">Duration (months)</RequiredLabel>
              <Input
                id="fd-project-duration"
                type="number"
                placeholder="Enter duration"
                {...register("duration", { valueAsNumber: true })}
              />
              {errors.duration ? (
                <p className="text-sm text-destructive">{errors.duration.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="fd-project-minimum">Minimum Amount</RequiredLabel>
              <Input
                id="fd-project-minimum"
                type="number"
                step="0.01"
                placeholder="Enter minimum amount"
                {...register("minimumAmount", { valueAsNumber: true })}
              />
              {errors.minimumAmount ? (
                <p className="text-sm text-destructive">{errors.minimumAmount.message}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel>Maturity calculation</RequiredLabel>
              <Select
                value={maturityCalculationMethod}
                onValueChange={(value) =>
                  setValue("maturityCalculationMethod", value as MaturityCalculationMethod, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_RS_100">Return per Rs.100</SelectItem>
                  <SelectItem value="MULTIPLE_OF_PRINCIPAL">
                    Maturity multiple (× principal)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel htmlFor="fd-project-maturity-value">{valueLabel}</RequiredLabel>
              <Input
                id="fd-project-maturity-value"
                type="number"
                step="0.01"
                placeholder={valuePlaceholder}
                {...register("maturityValue", { valueAsNumber: true })}
              />
              {errors.maturityValue ? (
                <p className="text-sm text-destructive">{errors.maturityValue.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

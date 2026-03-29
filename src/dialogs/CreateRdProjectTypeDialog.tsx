import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateRdProjectTypeMutation } from "@/hooks/useRdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  duration: z
    .number({ message: "Duration is required" })
    .int("Duration must be a whole number")
    .min(1)
    .max(360),
  minimumMonthlyAmount: z.number().min(1, "Minimum monthly amount must be greater than 0").max(100000000),
  interestType: z.enum(["RATE", "MATURITY_PER_HUNDRED"], { message: "Select interest type" }),
  interestValue: z.number().min(0, "Value cannot be negative").max(1000000),
  fineRatePerHundred: z.number().min(0).max(1000000),
  graceDays: z.number().int().min(0).max(365),
  penaltyMultiplier: z.number().min(0).max(1000),
  penaltyStartMonth: z.number().int().min(1).max(360),
});

type FormData = z.infer<typeof schema>;

interface CreateRdProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
}

export const CreateRdProjectTypeDialog = ({ open, onOpenChange, societyId }: CreateRdProjectTypeDialogProps) => {
  const mutation = useCreateRdProjectTypeMutation(societyId);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      duration: 12,
      minimumMonthlyAmount: 1000,
      interestType: "MATURITY_PER_HUNDRED",
      interestValue: 5,
      fineRatePerHundred: 2,
      graceDays: 7,
      penaltyMultiplier: 1,
      penaltyStartMonth: 1,
    },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const interestType = watch("interestType");

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync({
        name: values.name,
        duration: values.duration,
        minimumMonthlyAmount: values.minimumMonthlyAmount,
        interestRate: values.interestType === "RATE" ? values.interestValue : undefined,
        maturityPerHundred: values.interestType === "MATURITY_PER_HUNDRED" ? values.interestValue : undefined,
        fineRatePerHundred: values.fineRatePerHundred,
        graceDays: values.graceDays,
        penaltyMultiplier: values.penaltyMultiplier,
        penaltyStartMonth: values.penaltyStartMonth,
      });
      toast.success("RD project type created");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create RD project type"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create RD Project Type</DialogTitle>
          <DialogDescription>Monthly installment, fine, and maturity interest configuration.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel htmlFor="rd-pt-name">Name</RequiredLabel>
            <Input id="rd-pt-name" placeholder="RD 24 Month" {...register("name")} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-duration">Duration (months)</RequiredLabel>
              <Input id="rd-pt-duration" type="number" {...register("duration", { valueAsNumber: true })} />
              {errors.duration ? <p className="text-sm text-destructive">{errors.duration.message}</p> : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-min">Minimum monthly amount</RequiredLabel>
              <Input
                id="rd-pt-min"
                type="number"
                step="0.01"
                {...register("minimumMonthlyAmount", { valueAsNumber: true })}
              />
              {errors.minimumMonthlyAmount ? (
                <p className="text-sm text-destructive">{errors.minimumMonthlyAmount.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel>Interest at maturity</RequiredLabel>
              <Select
                value={interestType}
                onValueChange={(v) => setValue("interestType", v as FormData["interestType"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RATE">Interest rate % on total principal</SelectItem>
                  <SelectItem value="MATURITY_PER_HUNDRED">Amount per ₹100 of total principal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-int-val">Value</RequiredLabel>
              <Input id="rd-pt-int-val" type="number" step="0.01" {...register("interestValue", { valueAsNumber: true })} />
              {errors.interestValue ? <p className="text-sm text-destructive">{errors.interestValue.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-fine">Fine rate (per ₹100 of monthly amount)</RequiredLabel>
              <Input id="rd-pt-fine" type="number" step="0.01" {...register("fineRatePerHundred", { valueAsNumber: true })} />
              {errors.fineRatePerHundred ? (
                <p className="text-sm text-destructive">{errors.fineRatePerHundred.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-grace">Grace days</RequiredLabel>
              <Input id="rd-pt-grace" type="number" {...register("graceDays", { valueAsNumber: true })} />
              {errors.graceDays ? <p className="text-sm text-destructive">{errors.graceDays.message}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-pen-mul">Penalty multiplier</RequiredLabel>
              <Input
                id="rd-pt-pen-mul"
                type="number"
                step="0.01"
                {...register("penaltyMultiplier", { valueAsNumber: true })}
              />
              {errors.penaltyMultiplier ? (
                <p className="text-sm text-destructive">{errors.penaltyMultiplier.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-pen-start">Penalty from month (streak)</RequiredLabel>
              <Input id="rd-pt-pen-start" type="number" {...register("penaltyStartMonth", { valueAsNumber: true })} />
              {errors.penaltyStartMonth ? (
                <p className="text-sm text-destructive">{errors.penaltyStartMonth.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useState } from "react";
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
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateRdProjectTypeMutation } from "@/hooks/useRdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  Dialog as HelpDialog,
  DialogContent as HelpDialogContent,
  DialogDescription as HelpDialogDescription,
  DialogHeader as HelpDialogHeader,
  DialogTitle as HelpDialogTitle,
} from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  duration: z
    .number({ message: "Duration is required" })
    .int("Duration must be a whole number")
    .min(1)
    .max(360),
  minimumMonthlyAmount: z
    .number()
    .min(1, "Minimum monthly amount must be greater than 0")
    .max(100000000),
  maturityPerHundred: z.number().min(0, "Maturity per hundred cannot be negative").max(1000000),
  fineRatePerHundred: z.number().min(0).max(1000000),
  graceDays: z.number().int().min(0).max(365),
  penaltyMultiplier: z.number().min(0).max(1000).optional(),
  penaltyStartMonth: z.number().int().min(1).max(360).optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateRdProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
}

export const CreateRdProjectTypeDialog = ({
  open,
  onOpenChange,
  societyId,
}: CreateRdProjectTypeDialogProps) => {
  const [helpOpen, setHelpOpen] = useState(false);
  const mutation = useCreateRdProjectTypeMutation(societyId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      duration: undefined,
      minimumMonthlyAmount: undefined,
      maturityPerHundred: undefined,
      fineRatePerHundred: undefined,
      graceDays: undefined,
      penaltyMultiplier: undefined,
      penaltyStartMonth: undefined,
    },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync({
        name: values.name,
        duration: values.duration,
        minimumMonthlyAmount: values.minimumMonthlyAmount,
        maturityPerHundred: values.maturityPerHundred,
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
          <DialogDescription>
            Monthly installment, fine, and maturity interest configuration.
          </DialogDescription>
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
              <Input
                id="rd-pt-duration"
                type="number"
                placeholder="e.g. 12"
                {...register("duration", { valueAsNumber: true })}
              />
              {errors.duration ? (
                <p className="text-sm text-destructive">{errors.duration.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-min">Minimum monthly amount</RequiredLabel>
              <Input
                id="rd-pt-min"
                type="number"
                step="0.01"
                placeholder="e.g. 1000"
                {...register("minimumMonthlyAmount", { valueAsNumber: true })}
              />
              {errors.minimumMonthlyAmount ? (
                <p className="text-sm text-destructive">{errors.minimumMonthlyAmount.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-maturity-per-hundred">Maturity per hundred</RequiredLabel>
              <Input
                id="rd-pt-maturity-per-hundred"
                type="number"
                step="0.01"
                placeholder="e.g. 5"
                {...register("maturityPerHundred", { valueAsNumber: true })}
              />
              {errors.maturityPerHundred ? (
                <p className="text-sm text-destructive">{errors.maturityPerHundred.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-fine">
                Fine rate (per ₹100 of monthly amount)
              </RequiredLabel>
              <Input
                id="rd-pt-fine"
                type="number"
                step="0.01"
                placeholder="e.g. 2"
                {...register("fineRatePerHundred", { valueAsNumber: true })}
              />
              {errors.fineRatePerHundred ? (
                <p className="text-sm text-destructive">{errors.fineRatePerHundred.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-grace">Grace days</RequiredLabel>
              <Input
                id="rd-pt-grace"
                type="number"
                placeholder="e.g. 7"
                {...register("graceDays", { valueAsNumber: true })}
              />
              {errors.graceDays ? (
                <p className="text-sm text-destructive">{errors.graceDays.message}</p>
              ) : null}
            </div>
            <div className="hidden sm:block" />
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Advanced penalty settings (optional)</summary>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel htmlFor="rd-pt-pen-mul">Penalty multiplier</RequiredLabel>
                <Input
                  id="rd-pt-pen-mul"
                  type="number"
                  step="0.01"
                  placeholder="Leave empty to use default 1"
                  {...register("penaltyMultiplier", {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                />
                {errors.penaltyMultiplier ? (
                  <p className="text-sm text-destructive">{errors.penaltyMultiplier.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="rd-pt-pen-start">Penalty from month (streak)</RequiredLabel>
                <Input
                  id="rd-pt-pen-start"
                  type="number"
                  placeholder="Leave empty to use default 1"
                  {...register("penaltyStartMonth", {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                />
                {errors.penaltyStartMonth ? (
                  <p className="text-sm text-destructive">{errors.penaltyStartMonth.message}</p>
                ) : null}
              </div>
            </div>
            <Button type="button" variant="outline" className="mt-3" onClick={() => setHelpOpen(true)}>
              Help: how penalty works
            </Button>
          </details>

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
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen}>
        <HelpDialogContent className="sm:max-w-[560px]">
          <HelpDialogHeader>
            <HelpDialogTitle>Penalty settings explained</HelpDialogTitle>
            <HelpDialogDescription>
              These settings affect overdue fine escalation after grace period.
            </HelpDialogDescription>
          </HelpDialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Base fine = (monthlyAmount / 100) × fineRatePerHundred.
            </p>
            <p>
              Penalty from month = streak month at which multiplier starts.
            </p>
            <p>
              Penalty multiplier = multiplier applied once streak reaches that month.
            </p>
            <p>
              Example: monthlyAmount 5000, fineRatePerHundred 2 gives base fine 100.
            </p>
            <p>
              If penaltyFromMonth = 2 and multiplier = 1.5:
              month1 overdue fine = 100, month2 overdue fine = (100*2)*1.5 = 300.
            </p>
            <p>
              If both fields are empty, system defaults are used (multiplier 1 and start month 1).
            </p>
          </div>
        </HelpDialogContent>
      </HelpDialog>
    </Dialog>
  );
};

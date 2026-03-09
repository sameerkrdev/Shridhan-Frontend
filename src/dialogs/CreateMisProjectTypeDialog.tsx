import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateMisProjectTypeMutation } from "@/hooks/useMisApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  duration: z
    .number({ message: "Duration is required" })
    .int("Duration must be a whole number")
    .min(1, "Duration must be at least 1")
    .max(360, "Duration is too large"),
  minimumAmount: z
    .number({ message: "Minimum amount is required" })
    .min(1, "Minimum amount must be greater than 0")
    .max(100000000, "Minimum amount is too large"),
  interestType: z.enum(["RATE", "AMOUNT_PER_THOUSAND"], {
    message: "Please select interest type",
  }),
  interestValue: z
    .number({ message: "Interest value is required" })
    .min(0, "Value cannot be negative")
    .max(1000000, "Value is too large"),
});

type FormData = z.infer<typeof schema>;

interface CreateMisProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
}

export const CreateMisProjectTypeDialog = ({
  open,
  onOpenChange,
  societyId,
}: CreateMisProjectTypeDialogProps) => {
  const mutation = useCreateMisProjectTypeMutation(societyId);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    resetField,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      duration: undefined,
      minimumAmount: undefined,
      interestType: undefined,
      interestValue: undefined,
    },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const interestType = watch("interestType");
  const interestValue = watch("interestValue");

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync({
        name: values.name,
        duration: values.duration,
        minimumAmount: values.minimumAmount,
        monthlyInterestRate: values.interestType === "RATE" ? values.interestValue : undefined,
        monthlyInterestPerLakh: values.interestType === "AMOUNT_PER_THOUSAND" ? values.interestValue : undefined,
      });
      toast.success("MIS project type created");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create MIS project type"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create MIS Project Type</DialogTitle>
          <DialogDescription>Define MIS monthly payout configuration.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel htmlFor="mis-project-name">Name</RequiredLabel>
            <Input id="mis-project-name" placeholder="MIS 36 Month" {...register("name")} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="mis-project-duration">Duration (months)</RequiredLabel>
              <Input
                id="mis-project-duration"
                type="number"
                placeholder="Enter duration"
                {...register("duration", { valueAsNumber: true })}
              />
              {errors.duration ? <p className="text-sm text-destructive">{errors.duration.message}</p> : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="mis-project-minimum">Minimum Amount</RequiredLabel>
              <Input
                id="mis-project-minimum"
                type="number"
                step="0.01"
                placeholder="Enter minimum amount"
                {...register("minimumAmount", { valueAsNumber: true })}
              />
              {errors.minimumAmount ? <p className="text-sm text-destructive">{errors.minimumAmount.message}</p> : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="mis-rate">Interest Type</RequiredLabel>
              <Select
                value={interestType}
                onValueChange={(value) => {
                  setValue("interestType", value as "RATE" | "AMOUNT_PER_THOUSAND", { shouldValidate: true });
                  // Clear previous value whenever interest type changes.
                  resetField("interestValue");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select interest type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RATE">Rate (%)</SelectItem>
                  <SelectItem value="AMOUNT_PER_THOUSAND">Monthly Amount (Per Thousand)</SelectItem>
                </SelectContent>
              </Select>
              {errors.interestType ? <p className="text-sm text-destructive">{errors.interestType.message}</p> : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="mis-interest-value">
                {interestType === "RATE" ? "Monthly Interest Rate (%)" : "Monthly Amount Per Thousand"}
              </RequiredLabel>
              <Input
                id="mis-interest-value"
                type="number"
                step="0.01"
                placeholder={
                  interestType === "RATE"
                    ? "Enter monthly interest rate (%)"
                    : "Enter monthly amount per thousand"
                }
                {...register("interestValue", { valueAsNumber: true })}
              />
              {errors.interestValue ? <p className="text-sm text-destructive">{errors.interestValue.message}</p> : null}
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p>
              Selected Type: <span className="font-medium">{interestType === "RATE" ? "Rate (%)" : "Amount Per Thousand"}</span>
            </p>
            <p className="text-muted-foreground">Entered Value: {Number.isFinite(interestValue) ? interestValue : "N/A"}</p>
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

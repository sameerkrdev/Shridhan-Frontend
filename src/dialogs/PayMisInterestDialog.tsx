import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequiredLabel } from "@/components/ui/required-label";
import { usePayMisInterestMutation } from "@/hooks/useMisApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

const schema = z
  .object({
    mode: z.enum(["single", "multiple"]),
    month: z.number().int().min(1).optional(),
    monthsCsv: z.string().optional(),
    amount: z.number().min(1, "Amount must be greater than 0"),
    paymentMethod: z.enum(["UPI", "CASH", "CHEQUE"]).optional(),
    transactionId: z.string().optional(),
    upiId: z.string().optional(),
    bankName: z.string().optional(),
    chequeNumber: z.string().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.mode === "single" && payload.month === undefined) {
      ctx.addIssue({ code: "custom", path: ["month"], message: "Month is required for single mode" });
    }
    if (payload.mode === "multiple" && !payload.monthsCsv?.trim()) {
      ctx.addIssue({ code: "custom", path: ["monthsCsv"], message: "Months are required for multiple mode" });
    }
    if (payload.paymentMethod === "UPI") {
      if (!payload.upiId) ctx.addIssue({ code: "custom", path: ["upiId"], message: "UPI ID is required" });
      if (!payload.transactionId) {
        ctx.addIssue({ code: "custom", path: ["transactionId"], message: "Transaction ID is required" });
      }
    }
    if (payload.paymentMethod === "CHEQUE") {
      if (!payload.bankName) ctx.addIssue({ code: "custom", path: ["bankName"], message: "Bank name is required" });
      if (!payload.chequeNumber) {
        ctx.addIssue({ code: "custom", path: ["chequeNumber"], message: "Cheque number is required" });
      }
    }
  });

type FormData = z.infer<typeof schema>;

interface PayMisInterestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  misId: string;
  duration: number;
  monthlyInterest: number;
}

export const PayMisInterestDialog = ({
  open,
  onOpenChange,
  societyId,
  misId,
  duration,
  monthlyInterest,
}: PayMisInterestDialogProps) => {
  const mutation = usePayMisInterestMutation(societyId, misId);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: "single",
      month: 1,
      monthsCsv: "",
      amount: monthlyInterest,
      paymentMethod: "CASH",
      transactionId: "",
      upiId: "",
      bankName: "",
      chequeNumber: "",
    },
  });

  const mode = watch("mode");
  const paymentMethod = watch("paymentMethod");
  const monthsCsv = watch("monthsCsv") ?? "";

  const parsedMonths = useMemo(
    () =>
      monthsCsv
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0),
    [monthsCsv],
  );

  const onSubmit = async (values: FormData) => {
    try {
      const payload =
        values.mode === "single"
          ? {
              month: values.month,
              amount: values.amount,
              paymentMethod: values.paymentMethod,
              transactionId: values.transactionId || undefined,
              upiId: values.upiId || undefined,
              bankName: values.bankName || undefined,
              chequeNumber: values.chequeNumber || undefined,
            }
          : {
              months: parsedMonths,
              amount: values.amount,
              paymentMethod: values.paymentMethod,
              transactionId: values.transactionId || undefined,
              upiId: values.upiId || undefined,
              bankName: values.bankName || undefined,
              chequeNumber: values.chequeNumber || undefined,
            };

      await mutation.mutateAsync(payload);
      toast.success("Interest payment recorded");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to record interest payment"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Pay Interest</DialogTitle>
          <DialogDescription>Pay single-month, split-month, or multiple-month interest.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel>Mode</RequiredLabel>
            <Select value={mode} onValueChange={(value) => setValue("mode", value as "single" | "multiple")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Month / Split Payment</SelectItem>
                <SelectItem value="multiple">Multiple Months Together</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "single" ? (
            <div className="space-y-2">
              <RequiredLabel>Month</RequiredLabel>
              <Input type="number" min={1} max={duration} {...register("month", { valueAsNumber: true })} />
              {errors.month ? <p className="text-sm text-destructive">{errors.month.message}</p> : null}
            </div>
          ) : (
            <div className="space-y-2">
              <RequiredLabel>Months (comma separated)</RequiredLabel>
              <Input placeholder="1,2,3" {...register("monthsCsv")} />
              {errors.monthsCsv ? <p className="text-sm text-destructive">{errors.monthsCsv.message}</p> : null}
            </div>
          )}

          <div className="space-y-2">
            <RequiredLabel>Amount</RequiredLabel>
            <Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
            <p className="text-xs text-muted-foreground">
              Monthly interest: Rs. {monthlyInterest.toFixed(2)} | Duration: {duration} months
            </p>
          </div>

          <div className="space-y-2">
            <RequiredLabel>Payment Method</RequiredLabel>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setValue("paymentMethod", value as "UPI" | "CASH" | "CHEQUE")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === "UPI" ? (
            <>
              <div className="space-y-2">
                <RequiredLabel>Transaction ID</RequiredLabel>
                <Input {...register("transactionId")} />
                {errors.transactionId ? <p className="text-sm text-destructive">{errors.transactionId.message}</p> : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel>UPI ID</RequiredLabel>
                <Input {...register("upiId")} />
                {errors.upiId ? <p className="text-sm text-destructive">{errors.upiId.message}</p> : null}
              </div>
            </>
          ) : null}

          {paymentMethod === "CHEQUE" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <RequiredLabel>Bank Name</RequiredLabel>
                <Input {...register("bankName")} />
              </div>
              <div className="space-y-2">
                <RequiredLabel>Cheque Number</RequiredLabel>
                <Input {...register("chequeNumber")} />
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Save Interest Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

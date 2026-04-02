import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequiredLabel } from "@/components/ui/required-label";
import { SearchableSingleSelectAsync } from "@/components/ui/searchable-single-select";
import { usePayRdForAnyMutation, useRdDetailQuery } from "@/hooks/useRdApi";
import { previewRdPayment, type PaymentMethod } from "@/lib/rdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

const schema = z
  .object({
    recurringDepositId: z.string().optional(),
    amount: z.number().min(1, "Amount must be greater than 0").max(100000000),
    monthsScope: z.string().optional(),
    paymentMethod: z.enum(["UPI", "CASH", "CHEQUE"]),
    transactionId: z.string().optional(),
    upiId: z
      .string()
      .regex(/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/, "UPI ID is invalid")
      .optional()
      .or(z.literal("")),
    bankName: z.string().optional(),
    chequeNumber: z.string().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.paymentMethod === "UPI") {
      if (!payload.upiId) {
        ctx.addIssue({
          code: "custom",
          path: ["upiId"],
          message: "UPI ID is required for UPI payment",
        });
      }
      if (!payload.transactionId) {
        ctx.addIssue({
          code: "custom",
          path: ["transactionId"],
          message: "Transaction ID is required for UPI payment",
        });
      }
    }
    if (payload.paymentMethod === "CHEQUE") {
      if (!payload.chequeNumber?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["chequeNumber"],
          message: "Cheque number is required for cheque payment",
        });
      }
      if (!payload.bankName?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["bankName"],
          message: "Bank name is required for cheque payment",
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

interface AddRdTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  recurringDepositId?: string | null;
  recurringDepositOptions?: Array<{
    id: string;
    label: string;
  }>;
}

export const AddRdTransactionDialog = ({
  open,
  onOpenChange,
  societyId,
  recurringDepositId,
  recurringDepositOptions = [],
}: AddRdTransactionDialogProps) => {
  const mutation = usePayRdForAnyMutation(societyId);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      recurringDepositId: recurringDepositId ?? "",
      amount: undefined as unknown as number,
      monthsScope: "",
      paymentMethod: "CASH",
      transactionId: "",
      upiId: "",
      bankName: "",
      chequeNumber: "",
    },
  });

  const selectedRdId = watch("recurringDepositId") || recurringDepositId || "";
  const paymentMethod = watch("paymentMethod");
  const amount = watch("amount");
  const monthsScope = watch("monthsScope");

  const { data: rdDetail, isLoading: isRdDetailLoading } = useRdDetailQuery(
    societyId,
    selectedRdId || null,
    open && Boolean(selectedRdId),
  );

  const monthsParsed = useMemo(() => {
    const raw = (monthsScope ?? "").trim();
    if (!raw) return undefined;
    return raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
  }, [monthsScope]);

  const [previewMaxDue, setPreviewMaxDue] = useState<string | null>(null);
  const [previewPending, setPreviewPending] = useState(false);

  useEffect(() => {
    if (!open) {
      reset();
      clearErrors();
      setPreviewMaxDue(null);
      return;
    }
    if (recurringDepositId) {
      setValue("recurringDepositId", recurringDepositId);
    }
  }, [clearErrors, recurringDepositId, open, reset, setValue]);

  useEffect(() => {
    if (!open || !selectedRdId || societyId === "") {
      return;
    }
    const num = Number(amount);
    if (!amount || Number.isNaN(num) || num <= 0) {
      setPreviewMaxDue(null);
      return;
    }
    const t = window.setTimeout(() => {
      setPreviewPending(true);
      void previewRdPayment(societyId, selectedRdId, {
        amount: num,
        months: monthsParsed?.length ? monthsParsed : undefined,
        skipFinePolicy: "none",
      })
        .then((res) => {
          setPreviewMaxDue(res.maxDue);
        })
        .catch(() => {
          setPreviewMaxDue(null);
        })
        .finally(() => {
          setPreviewPending(false);
        });
    }, 400);
    return () => window.clearTimeout(t);
  }, [amount, monthsParsed, open, selectedRdId, societyId]);

  const maxDueNum = previewMaxDue !== null ? Number(previewMaxDue) : NaN;
  const outstanding = rdDetail ? Number(rdDetail.summary.totalOutstanding) : null;

  const onSubmit = async (values: FormData) => {
    try {
      const targetRdId = values.recurringDepositId || recurringDepositId;
      if (!targetRdId) {
        setError("recurringDepositId", { type: "manual", message: "Please select an RD account" });
        return;
      }

      if (!Number.isNaN(maxDueNum) && values.amount > maxDueNum) {
        setError("amount", {
          type: "manual",
          message: `Amount cannot exceed total due for this scope (Rs. ${maxDueNum.toFixed(2)})`,
        });
        return;
      }

      await mutation.mutateAsync({
        rdId: targetRdId,
        amount: values.amount,
        months: monthsParsed?.length ? monthsParsed : undefined,
        skipFinePolicy: "none",
        paymentMethod: values.paymentMethod,
        transactionId: values.transactionId || undefined,
        upiId: values.upiId || undefined,
        bankName: values.bankName || undefined,
        chequeNumber: values.chequeNumber || undefined,
      });
      toast.success("Transaction recorded");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to add transaction"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>Record a payment toward this recurring deposit account.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {!recurringDepositId ? (
            <div className="space-y-2">
              <RequiredLabel>RD Account</RequiredLabel>
              <SearchableSingleSelectAsync
                value={selectedRdId}
                onChange={(value) => setValue("recurringDepositId", value, { shouldValidate: true })}
                options={recurringDepositOptions.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                placeholder="Search RD by customer name or phone"
              />
              {errors.recurringDepositId?.message ? (
                <p className="text-sm text-destructive">{errors.recurringDepositId.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Months scope (optional, comma-separated indexes)</Label>
            <Input placeholder="e.g. 1,2,3" {...register("monthsScope")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <RequiredLabel>Amount</RequiredLabel>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter amount"
                {...register("amount", { valueAsNumber: true })}
              />
              {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel>Payment Method</RequiredLabel>
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setValue("paymentMethod", value as PaymentMethod, { shouldValidate: true })
                }
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
          </div>

          {isRdDetailLoading ? (
            <p className="text-sm text-muted-foreground">Loading account context...</p>
          ) : rdDetail ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                Total outstanding:{" "}
                <span className="font-semibold">
                  {outstanding !== null ? outstanding.toFixed(2) : "—"}
                </span>
              </p>
              {previewPending ? (
                <p className="text-xs text-muted-foreground">Updating preview...</p>
              ) : previewMaxDue !== null ? (
                <p className="text-xs text-muted-foreground">
                  Max due for this amount/scope (preview): Rs. {Number(previewMaxDue).toFixed(2)}
                </p>
              ) : null}
            </div>
          ) : null}

          {paymentMethod === "UPI" && (
            <div className="space-y-2">
              <Label>Transaction ID</Label>
              <Input placeholder="Enter transaction ID" {...register("transactionId")} />
              {errors.transactionId ? (
                <p className="text-sm text-destructive">{errors.transactionId.message}</p>
              ) : null}
            </div>
          )}

          {paymentMethod === "UPI" && (
            <div className="space-y-2">
              <Label>UPI ID</Label>
              <Input placeholder="Enter UPI ID" {...register("upiId")} />
              {errors.upiId ? <p className="text-sm text-destructive">{errors.upiId.message}</p> : null}
            </div>
          )}

          {paymentMethod === "CHEQUE" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input placeholder="Enter bank name" {...register("bankName")} />
                {errors.bankName ? <p className="text-sm text-destructive">{errors.bankName.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Cheque Number</Label>
                <Input placeholder="Enter cheque number" {...register("chequeNumber")} />
                {errors.chequeNumber ? (
                  <p className="text-sm text-destructive">{errors.chequeNumber.message}</p>
                ) : null}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !selectedRdId}>
              Add Transaction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect } from "react";
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
import { useAddTransactionForAnyFdMutation, useFdDetailQuery } from "@/hooks/useFixedDepositApi";
import type { PaymentMethod, TransactionType } from "@/lib/fixedDepositApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

const schema = z
  .object({
    fixedDepositId: z.string().optional(),
    type: z.enum(["CREDIT", "PAYOUT"]),
    amount: z.number().min(1, "Amount must be greater than 0").max(100000000),
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

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  fixedDepositId?: string | null;
  fixedDepositOptions?: Array<{
    id: string;
    label: string;
  }>;
}

export const AddTransactionDialog = ({
  open,
  onOpenChange,
  societyId,
  fixedDepositId,
  fixedDepositOptions = [],
}: AddTransactionDialogProps) => {
  const mutation = useAddTransactionForAnyFdMutation(societyId);
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
      fixedDepositId: fixedDepositId ?? "",
      type: "CREDIT",
      amount: 0,
      paymentMethod: "CASH",
      transactionId: "",
      upiId: "",
      bankName: "",
      chequeNumber: "",
    },
  });

  const selectedFdId = watch("fixedDepositId") || fixedDepositId || "";
  const paymentMethod = watch("paymentMethod");
  const type = watch("type");
  const amount = watch("amount");

  const { data: fixedDepositDetail, isLoading: isFdDetailLoading } = useFdDetailQuery(
    societyId,
    selectedFdId || null,
    open && Boolean(selectedFdId),
  );

  const totalCredit = (fixedDepositDetail?.transactions ?? [])
    .filter((transaction) => transaction.type === "CREDIT")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalPayout = (fixedDepositDetail?.transactions ?? [])
    .filter((transaction) => transaction.type === "PAYOUT")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const creditRemaining = fixedDepositDetail
    ? Math.max(0, Number(fixedDepositDetail.principalAmount) - totalCredit)
    : null;
  const payoutRemaining = fixedDepositDetail
    ? Math.max(0, Number(fixedDepositDetail.maturityAmount) - totalPayout)
    : null;
  const isCreditBlocked = creditRemaining !== null && creditRemaining <= 0;
  const isPayoutBlocked = payoutRemaining !== null && payoutRemaining <= 0;

  useEffect(() => {
    if (!open) {
      reset();
      clearErrors();
      return;
    }
    if (fixedDepositId) {
      setValue("fixedDepositId", fixedDepositId);
    }
  }, [clearErrors, fixedDepositId, open, reset, setValue]);

  useEffect(() => {
    if (!open) return;
    if (type === "CREDIT" && isCreditBlocked && !isPayoutBlocked) {
      setValue("type", "PAYOUT");
    }
    if (type === "PAYOUT" && isPayoutBlocked && !isCreditBlocked) {
      setValue("type", "CREDIT");
    }
  }, [isCreditBlocked, isPayoutBlocked, open, setValue, type]);

  const onSubmit = async (values: FormData) => {
    try {
      const targetFdId = values.fixedDepositId || fixedDepositId;
      if (!targetFdId) {
        setError("fixedDepositId", { type: "manual", message: "Please select an FD account" });
        return;
      }

      if (values.type === "CREDIT" && creditRemaining !== null && values.amount > creditRemaining) {
        setError("amount", {
          type: "manual",
          message: `Credit amount cannot exceed remaining deposit amount (${creditRemaining.toFixed(2)})`,
        });
        return;
      }
      if (values.type === "PAYOUT" && payoutRemaining !== null && values.amount > payoutRemaining) {
        setError("amount", {
          type: "manual",
          message: `Payout amount cannot exceed remaining maturity amount (${payoutRemaining.toFixed(2)})`,
        });
        return;
      }

      await mutation.mutateAsync({
        fdId: targetFdId,
        ...values,
      });
      toast.success("Transaction added");
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
          <DialogDescription>Create a new fixed deposit transaction entry.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {!fixedDepositId ? (
            <div className="space-y-2">
              <RequiredLabel>FD Account</RequiredLabel>
              <SearchableSingleSelectAsync
                value={selectedFdId}
                onChange={(value) => setValue("fixedDepositId", value, { shouldValidate: true })}
                options={fixedDepositOptions.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                placeholder="Search FD by id, customer name, phone"
              />
              {errors.fixedDepositId?.message ? (
                <p className="text-sm text-destructive">{errors.fixedDepositId.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <RequiredLabel>Type</RequiredLabel>
              <Select
                value={type}
                onValueChange={(value) => setValue("type", value as TransactionType, { shouldValidate: true })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT" disabled={isCreditBlocked}>
                    Credit {isCreditBlocked ? "(Blocked: deposit fully collected)" : ""}
                  </SelectItem>
                  <SelectItem value="PAYOUT" disabled={isPayoutBlocked}>
                    Payout {isPayoutBlocked ? "(Blocked: maturity fully paid)" : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <RequiredLabel>Amount</RequiredLabel>
              <Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
              {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
            </div>
          </div>

          {isFdDetailLoading ? (
            <p className="text-sm text-muted-foreground">Loading amount limits...</p>
          ) : fixedDepositDetail ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                Remaining Deposit Collection (Credit):{" "}
                <span className="font-semibold">{creditRemaining?.toFixed(2) ?? "0.00"}</span>
              </p>
              <p>
                Remaining Maturity Payout (Payout):{" "}
                <span className="font-semibold">{payoutRemaining?.toFixed(2) ?? "0.00"}</span>
              </p>
              {amount ? (
                <p className="text-xs text-muted-foreground">Entered amount: {Number(amount).toFixed(2)}</p>
              ) : null}
              {isCreditBlocked ? (
                <p className="text-xs text-amber-600">Credit is blocked because pending deposit is 0.</p>
              ) : null}
              {isPayoutBlocked ? (
                <p className="text-xs text-amber-600">Payout is blocked because remaining maturity is 0.</p>
              ) : null}
            </div>
          ) : null}

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

          {paymentMethod === "UPI" && (
            <div className="space-y-2">
              <Label>Transaction ID</Label>
              <Input {...register("transactionId")} />
              {errors.transactionId ? (
                <p className="text-sm text-destructive">{errors.transactionId.message}</p>
              ) : null}
            </div>
          )}

          {paymentMethod === "UPI" && (
            <div className="space-y-2">
              <Label>UPI ID</Label>
              <Input {...register("upiId")} />
              {errors.upiId ? <p className="text-sm text-destructive">{errors.upiId.message}</p> : null}
            </div>
          )}

          {paymentMethod === "CHEQUE" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input {...register("bankName")} />
                {errors.bankName ? <p className="text-sm text-destructive">{errors.bankName.message}</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Cheque Number</Label>
                <Input {...register("chequeNumber")} />
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
            <Button
              type="submit"
              disabled={mutation.isPending || !selectedFdId || (isCreditBlocked && isPayoutBlocked)}
            >
              Add Transaction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequiredLabel } from "@/components/ui/required-label";
import { SearchableSingleSelectAsync } from "@/components/ui/searchable-single-select";
import {
  useCreateRdFineWaiveRequestMutation,
  usePayRdForAnyMutation,
  useRdDetailQuery,
} from "@/hooks/useRdApi";
import { previewRdPayment, type PaymentMethod } from "@/lib/rdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/components/Can";
import { useAuthSessionStore } from "@/store/authSessionStore";

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
  const permissions = useAuthSessionStore((s) => s.selectedMembership?.permissions ?? []);
  const canRequestWaive = hasPermission(permissions, "recurring_deposit.request_fine_waive");
  const canApproveWaive = hasPermission(permissions, "recurring_deposit.approve_fine_waive");
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
  const [monthMode, setMonthMode] = useState<"single" | "multiple">("single");
  const [singleMonth, setSingleMonth] = useState<number | null>(null);
  const [multiMonths, setMultiMonths] = useState<number[]>([]);
  const [waiveScope, setWaiveScope] = useState<"none" | "all" | "selected">("none");
  const [waiveMonthsInput, setWaiveMonthsInput] = useState("");
  const [waiveReason, setWaiveReason] = useState("");
  const [waiveTtlDays, setWaiveTtlDays] = useState("7");
  const [reduceFromMaturity, setReduceFromMaturity] = useState(false);
  const createWaiveMutation = useCreateRdFineWaiveRequestMutation(societyId, selectedRdId);

  useEffect(() => {
    if (!open) {
      reset();
      clearErrors();
      setPreviewMaxDue(null);
      setMonthMode("single");
      setSingleMonth(null);
      setMultiMonths([]);
      setWaiveScope("none");
      setWaiveMonthsInput("");
      setWaiveReason("");
      setWaiveTtlDays("7");
      setReduceFromMaturity(false);
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
        skipFinePolicy: waiveScope === "none" ? "none" : waiveScope,
        skipFineMonths:
          waiveScope === "selected"
            ? waiveMonthsInput
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => !Number.isNaN(n) && n > 0)
            : undefined,
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
  }, [amount, monthsParsed, open, selectedRdId, societyId, waiveScope, waiveMonthsInput]);

  const maxDueNum = previewMaxDue !== null ? Number(previewMaxDue) : NaN;
  const outstanding = rdDetail ? Number(rdDetail.summary.totalOutstanding) : null;
  const monthOptions = useMemo(() => {
    if (!rdDetail?.installments?.length) return [] as number[];
    return Array.from(new Set(rdDetail.installments.map((row) => row.monthIndex))).sort((a, b) => a - b);
  }, [rdDetail?.installments]);
  const pendingMonthOptions = useMemo(() => {
    if (!rdDetail?.installments?.length) return [] as number[];
    return rdDetail.installments
      .filter((row) => Number(row.remainingPrincipal) > 0)
      .map((row) => row.monthIndex);
  }, [rdDetail?.installments]);

  const syncMonthsScope = (months: number[]) => {
    const normalized = [...new Set(months)].sort((a, b) => a - b);
    setValue("monthsScope", normalized.join(","), { shouldValidate: true });
  };

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

      let waiveRequestId: string | undefined;
      if (canRequestWaive && waiveScope !== "none") {
        const selectedMonths =
          waiveScope === "selected"
            ? waiveMonthsInput
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => !Number.isNaN(n) && n > 0)
            : undefined;
        const request = await createWaiveMutation.mutateAsync({
          scopeType: waiveScope,
          months: selectedMonths?.length ? selectedMonths : undefined,
          ttlDays: Number(waiveTtlDays) || 7,
          reduceFromMaturity,
          reason: waiveReason.trim() || undefined,
          autoApprove: canApproveWaive,
        });
        if (request.status !== "APPROVED") {
          toast.success("Fine waive request submitted for approval");
          onOpenChange(false);
          return;
        }
        waiveRequestId = request.id;
      }

      await mutation.mutateAsync({
        rdId: targetRdId,
        amount: values.amount,
        months: monthsParsed?.length ? monthsParsed : undefined,
        skipFinePolicy: "none",
        waiveRequestId,
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
          <DialogDescription>
            Record a payment toward this recurring deposit account.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {!recurringDepositId ? (
            <div className="space-y-2">
              <RequiredLabel>RD Account</RequiredLabel>
              <SearchableSingleSelectAsync
                value={selectedRdId}
                onChange={(value) =>
                  setValue("recurringDepositId", value, { shouldValidate: true })
                }
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
            <RequiredLabel>Month selection mode</RequiredLabel>
            <Select
              value={monthMode}
              onValueChange={(value) => {
                const nextMode = value as "single" | "multiple";
                setMonthMode(nextMode);
                if (nextMode === "single") {
                  setMultiMonths([]);
                  syncMonthsScope(singleMonth ? [singleMonth] : []);
                } else {
                  setSingleMonth(null);
                  syncMonthsScope(multiMonths);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Month</SelectItem>
                <SelectItem value="multiple">Multiple Months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {monthMode === "single" ? (
            <div className="space-y-2">
              <RequiredLabel>Month</RequiredLabel>
              <Select
                value={singleMonth ? String(singleMonth) : ""}
                onValueChange={(value) => {
                  const month = Number(value);
                  setSingleMonth(month);
                  syncMonthsScope([month]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => {
                    const enabled = pendingMonthOptions.includes(month);
                    return (
                      <SelectItem key={month} value={String(month)} disabled={!enabled}>
                        Month {month} {enabled ? "" : "(Paid)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <RequiredLabel>Months</RequiredLabel>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 max-h-44 overflow-auto">
                {monthOptions.map((month) => {
                  const enabled = pendingMonthOptions.includes(month);
                  const checked = multiMonths.includes(month);
                  return (
                    <label
                      key={month}
                      className={`flex items-center gap-2 text-sm ${enabled ? "" : "text-muted-foreground"}`}
                    >
                      <input
                        type="checkbox"
                        disabled={!enabled}
                        checked={checked}
                        onChange={(event) => {
                          const next = new Set(multiMonths);
                          if (event.target.checked) next.add(month);
                          else next.delete(month);
                          const nextList = Array.from(next).sort((a, b) => a - b);
                          setMultiMonths(nextList);
                          syncMonthsScope(nextList);
                        }}
                      />
                      <span>Month {month}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <RequiredLabel>Amount</RequiredLabel>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter amount"
                {...register("amount", { valueAsNumber: true })}
              />
              {errors.amount ? (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              ) : null}
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

          {canRequestWaive ? (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Fine waive-off request</Label>
              <Select value={waiveScope} onValueChange={(value) => setWaiveScope(value as typeof waiveScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No waive request</SelectItem>
                  <SelectItem value="all">Request waive for all due fine months</SelectItem>
                  <SelectItem value="selected">Request waive for selected fine months</SelectItem>
                </SelectContent>
              </Select>
              {waiveScope === "selected" ? (
                <Input
                  placeholder="Waive month indexes (e.g. 1,2,3)"
                  value={waiveMonthsInput}
                  onChange={(e) => setWaiveMonthsInput(e.target.value)}
                />
              ) : null}
              {waiveScope !== "none" ? (
                <>
                  <Input
                    placeholder="Reason (optional)"
                    value={waiveReason}
                    onChange={(e) => setWaiveReason(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    placeholder="Expiry in days (default 7)"
                    value={waiveTtlDays}
                    onChange={(e) => setWaiveTtlDays(e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={reduceFromMaturity}
                      onChange={(e) => setReduceFromMaturity(e.target.checked)}
                    />
                    Reduce waived fine from maturity amount
                  </label>
                </>
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
              {errors.upiId ? (
                <p className="text-sm text-destructive">{errors.upiId.message}</p>
              ) : null}
            </div>
          )}

          {paymentMethod === "CHEQUE" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input placeholder="Enter bank name" {...register("bankName")} />
                {errors.bankName ? (
                  <p className="text-sm text-destructive">{errors.bankName.message}</p>
                ) : null}
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
            <Button type="submit" disabled={mutation.isPending || createWaiveMutation.isPending || !selectedRdId}>
              Add Transaction
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useAddTransactionForAnyFdMutation,
  useCreateFdEarlyPayoutRequestMutation,
  useFdDetailQuery,
  useFdEarlyPayoutRequestsQuery,
} from "@/hooks/useFixedDepositApi";
import type { PaymentMethod, TransactionType } from "@/lib/fixedDepositApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { hasPermission } from "@/components/Can";
import { formatDateTime } from "@/lib/dateFormat";

function isBeforeMaturityDate(iso: string): boolean {
  const end = new Date(iso);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return now < end;
}

const schema = z
  .object({
    fixedDepositId: z.string().optional(),
    type: z.enum(["CREDIT", "PAYOUT"]),
    amount: z.number().min(1, "Amount must be greater than 0").max(100000000),
    fdEarlyPayoutRequestId: z.string().optional(),
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

const earlyPayoutRequestSchema = z.object({
  amount: z.number().min(1, "Amount must be greater than 0").max(100_000_000),
  ttlDays: z.number().int().min(1, "Use 1–30 days").max(30, "Use 1–30 days"),
  recalculatePrincipalAndMaturity: z.boolean(),
  reason: z.string().max(2000).optional(),
});

type EarlyPayoutRequestFormData = z.infer<typeof earlyPayoutRequestSchema>;

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
  const permissions = useAuthSessionStore((s) => s.selectedMembership?.permissions ?? []);
  const canRequestEarlyPayout = hasPermission(permissions, "fixed_deposit.request_early_payout");
  const canApproveEarlyPayout = hasPermission(permissions, "fixed_deposit.approve_early_payout");
  const mutation = useAddTransactionForAnyFdMutation(societyId);
  const [earlyPayoutAck, setEarlyPayoutAck] = useState(false);
  const [mainTab, setMainTab] = useState<"transaction" | "early_request">("transaction");
  const [submitForApproverReview, setSubmitForApproverReview] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fixedDepositId: fixedDepositId ?? "",
      type: "CREDIT",
      amount: undefined as unknown as number,
      paymentMethod: "CASH",
      transactionId: "",
      upiId: "",
      bankName: "",
      chequeNumber: "",
      fdEarlyPayoutRequestId: "",
    },
  });

  const [watchedFdId, paymentMethod, type, amount, fdEarlyPayoutRequestId] = useWatch({
    control,
    name: ["fixedDepositId", "paymentMethod", "type", "amount", "fdEarlyPayoutRequestId"],
  });
  const selectedFdId = watchedFdId || fixedDepositId || "";

  const createEarlyPayoutRequestMutation = useCreateFdEarlyPayoutRequestMutation(
    societyId,
    selectedFdId,
  );

  const {
    register: registerEarlyRequest,
    handleSubmit: handleSubmitEarlyRequest,
    reset: resetEarlyRequest,
    setValue: setEarlyRequestValue,
    control: earlyRequestControl,
    formState: { errors: earlyRequestErrors },
  } = useForm<EarlyPayoutRequestFormData>({
    resolver: zodResolver(earlyPayoutRequestSchema),
    defaultValues: {
      amount: undefined as unknown as number,
      ttlDays: 7,
      recalculatePrincipalAndMaturity: false,
      reason: "",
    },
  });

  const earlyRequestRecalc = useWatch({
    control: earlyRequestControl,
    name: "recalculatePrincipalAndMaturity",
    defaultValue: false,
  });

  const { data: fixedDepositDetail, isLoading: isFdDetailLoading } = useFdDetailQuery(
    societyId,
    selectedFdId || null,
    open && Boolean(selectedFdId),
  );

  const isEarlyPayoutFlow =
    type === "PAYOUT" &&
    Boolean(fixedDepositDetail?.maturityDate) &&
    isBeforeMaturityDate(fixedDepositDetail!.maturityDate);

  const { data: earlyPayoutRequests = [], isLoading: isEarlyRequestsLoading } =
    useFdEarlyPayoutRequestsQuery(societyId, selectedFdId || null, open && Boolean(selectedFdId));

  const approvedEarlyPayouts = useMemo(
    () =>
      earlyPayoutRequests.filter(
        (r) => r.status === "APPROVED" && (r.linkedTransactions?.length ?? 0) === 0,
      ),
    [earlyPayoutRequests],
  );

  const selectedEarlyRequest = useMemo(
    () => approvedEarlyPayouts.find((r) => r.id === fdEarlyPayoutRequestId) ?? null,
    [approvedEarlyPayouts, fdEarlyPayoutRequestId],
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

  const showEarlyPayoutRequestTab =
    canRequestEarlyPayout &&
    Boolean(selectedFdId) &&
    fixedDepositDetail?.status === "ACTIVE" &&
    Boolean(fixedDepositDetail?.maturityDate) &&
    isBeforeMaturityDate(fixedDepositDetail.maturityDate);

  useEffect(() => {
    if (!open) {
      reset();
      clearErrors();
      setEarlyPayoutAck(false);
      resetEarlyRequest();
      setMainTab("transaction");
      setSubmitForApproverReview(false);
      return;
    }
    if (fixedDepositId) {
      setValue("fixedDepositId", fixedDepositId);
    }
  }, [clearErrors, fixedDepositId, open, reset, resetEarlyRequest, setValue]);

  useEffect(() => {
    if (!showEarlyPayoutRequestTab && mainTab === "early_request") {
      setMainTab("transaction");
    }
  }, [mainTab, showEarlyPayoutRequestTab]);

  useEffect(() => {
    if (!isEarlyPayoutFlow) {
      setEarlyPayoutAck(false);
      setValue("fdEarlyPayoutRequestId", "");
    }
  }, [isEarlyPayoutFlow, setValue]);

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

      const earlyFlow =
        values.type === "PAYOUT" &&
        fixedDepositDetail?.maturityDate &&
        isBeforeMaturityDate(fixedDepositDetail.maturityDate);

      if (earlyFlow) {
        if (!values.fdEarlyPayoutRequestId?.trim()) {
          setError("fdEarlyPayoutRequestId", {
            type: "manual",
            message: "Select an approved early payout request",
          });
          return;
        }
        if (!earlyPayoutAck) {
          toast.error("Confirm that this payout matches the approved early payout request");
          return;
        }
      }

      await mutation.mutateAsync({
        fdId: targetFdId,
        ...values,
        ...(earlyFlow && values.fdEarlyPayoutRequestId
          ? { fdEarlyPayoutRequestId: values.fdEarlyPayoutRequestId }
          : {}),
      });
      toast.success("Transaction added");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to add transaction"));
    }
  };

  const onSubmitEarlyRequest = async (values: EarlyPayoutRequestFormData) => {
    if (!selectedFdId) {
      toast.error("Select an FD account first");
      return;
    }
    try {
      await createEarlyPayoutRequestMutation.mutateAsync({
        amount: values.amount,
        ttlDays: values.ttlDays,
        recalculatePrincipalAndMaturity: values.recalculatePrincipalAndMaturity,
        reason: values.reason?.trim() || undefined,
        ...(canApproveEarlyPayout && submitForApproverReview
          ? { submitForApproverReview: true }
          : {}),
      });
      toast.success(
        canApproveEarlyPayout && !submitForApproverReview
          ? "Early payout request auto-approved"
          : "Early payout request submitted",
      );
      resetEarlyRequest();
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create request"));
    }
  };

  const transactionFormBody = (
    <>
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
            onValueChange={(value) =>
              setValue("type", value as TransactionType, { shouldValidate: true })
            }
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
            <p className="text-xs text-muted-foreground">
              Entered amount: {Number(amount).toFixed(2)}
            </p>
          ) : null}
          {isCreditBlocked ? (
            <p className="text-xs text-amber-600">
              Credit is blocked because pending deposit is 0.
            </p>
          ) : null}
          {isPayoutBlocked ? (
            <p className="text-xs text-amber-600">
              Payout is blocked because remaining maturity is 0.
            </p>
          ) : null}
        </div>
      ) : null}

      {isEarlyPayoutFlow ? (
        <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Before maturity: payout must match an approved early payout request.
          </p>
          {isEarlyRequestsLoading ? (
            <p className="text-sm text-muted-foreground">Loading requests…</p>
          ) : approvedEarlyPayouts.length === 0 ? (
            <p className="text-sm text-destructive">
              No approved early payout request. Ask someone with approval rights to accept a
              request, or use the <strong>Request early payout</strong> tab here to submit one.
            </p>
          ) : (
            <div className="space-y-2">
              <RequiredLabel>Approved early payout request</RequiredLabel>
              <Select
                value={fdEarlyPayoutRequestId || undefined}
                onValueChange={(value) => {
                  setValue("fdEarlyPayoutRequestId", value, { shouldValidate: true });
                  const row = approvedEarlyPayouts.find((r) => r.id === value);
                  if (row) {
                    setValue("amount", Number(row.amount), { shouldValidate: true });
                  }
                  setEarlyPayoutAck(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select request" />
                </SelectTrigger>
                <SelectContent>
                  {approvedEarlyPayouts.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      Rs. {Number(r.amount).toFixed(2)} · Recalc:{" "}
                      {r.recalculatePrincipalAndMaturity ? "Yes" : "No"} · Approval deadline{" "}
                      {formatDateTime(r.expiresAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fdEarlyPayoutRequestId?.message ? (
                <p className="text-sm text-destructive">{errors.fdEarlyPayoutRequestId.message}</p>
              ) : null}
              {selectedEarlyRequest ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    Approved recalculate principal & maturity:{" "}
                    <span className="font-medium text-foreground">
                      {selectedEarlyRequest.recalculatePrincipalAndMaturity ? "Yes" : "No"}
                    </span>{" "}
                    (applied when you post this payout; server uses the approved request)
                  </p>
                </div>
              ) : null}
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="early-payout-confirm"
                  checked={earlyPayoutAck}
                  onCheckedChange={(c) => setEarlyPayoutAck(c === true)}
                />
                <label htmlFor="early-payout-confirm" className="text-sm cursor-pointer">
                  I confirm the amount matches the selected approved request
                </label>
              </div>
            </div>
          )}
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
            {errors.bankName ? (
              <p className="text-sm text-destructive">{errors.bankName.message}</p>
            ) : null}
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
          disabled={
            mutation.isPending ||
            !selectedFdId ||
            (isCreditBlocked && isPayoutBlocked) ||
            (isEarlyPayoutFlow &&
              (!approvedEarlyPayouts.length || !earlyPayoutAck || !fdEarlyPayoutRequestId))
          }
        >
          Add Transaction
        </Button>
      </div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {showEarlyPayoutRequestTab && mainTab === "early_request"
              ? "Request early payout"
              : "Add transaction"}
          </DialogTitle>
          <DialogDescription>
            {showEarlyPayoutRequestTab && mainTab === "early_request"
              ? !canApproveEarlyPayout
                ? "Submit a request for approval. After it is approved, use the Add transaction tab to record the payout with the same amount."
                : submitForApproverReview
                  ? "Submit a request for another approver to review. When it is approved, use the Add transaction tab to record the payout with the same amount."
                  : "Submit the request for immediate approval (your role can approve early payouts). Then use the Add transaction tab to record the payout with the same amount."
              : "Create a new fixed deposit transaction entry."}
          </DialogDescription>
        </DialogHeader>

        {showEarlyPayoutRequestTab ? (
          <Tabs
            value={mainTab}
            onValueChange={(v) => setMainTab(v as "transaction" | "early_request")}
            className="gap-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transaction">Add transaction</TabsTrigger>
              <TabsTrigger value="early_request">Request early payout</TabsTrigger>
            </TabsList>
            <TabsContent value="transaction" className="mt-0">
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                {transactionFormBody}
              </form>
            </TabsContent>
            <TabsContent value="early_request" className="mt-0">
              <form className="space-y-4" onSubmit={handleSubmitEarlyRequest(onSubmitEarlyRequest)}>
                {!canApproveEarlyPayout || submitForApproverReview ? (
                  <p className="text-sm text-muted-foreground">
                    Approvers are notified by email and in-app. When the request is approved, return
                    here and use <strong>Add transaction</strong> → Payout to post it.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Use the note below to approve immediately or send for another approver. After
                    the request is approved, use <strong>Add transaction</strong> → Payout to post
                    it.
                  </p>
                )}
                {canApproveEarlyPayout ? (
                  <div className="rounded-md border border-blue-500/35 bg-blue-500/5 p-3 text-sm space-y-3">
                    <p className="font-medium text-foreground">
                      {submitForApproverReview
                        ? "This request will stay pending until another approver accepts or rejects it."
                        : "This request will be auto-approved immediately because your role can approve early payouts."}
                    </p>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="early-payout-req-review"
                        checked={submitForApproverReview}
                        onCheckedChange={(c) => setSubmitForApproverReview(c === true)}
                      />
                      <Label
                        htmlFor="early-payout-req-review"
                        className="text-sm font-normal cursor-pointer leading-snug"
                      >
                        Send for another approver to review (do not auto-approve)
                      </Label>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="early-payout-req-amount">Payout amount (Rs.)</Label>
                  <Input
                    id="early-payout-req-amount"
                    type="number"
                    step="0.01"
                    placeholder="Amount to pay out"
                    {...registerEarlyRequest("amount", { valueAsNumber: true })}
                  />
                  {earlyRequestErrors.amount ? (
                    <p className="text-sm text-destructive">{earlyRequestErrors.amount.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="early-payout-req-ttl">Approval window (days)</Label>
                  <Input
                    id="early-payout-req-ttl"
                    type="number"
                    {...registerEarlyRequest("ttlDays", { valueAsNumber: true })}
                  />
                  {earlyRequestErrors.ttlDays ? (
                    <p className="text-sm text-destructive">{earlyRequestErrors.ttlDays.message}</p>
                  ) : null}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="early-payout-req-recalc"
                    checked={earlyRequestRecalc}
                    onCheckedChange={(c) =>
                      setEarlyRequestValue("recalculatePrincipalAndMaturity", c === true)
                    }
                  />
                  <Label
                    htmlFor="early-payout-req-recalc"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Recalculate principal and maturity after payout (reduce principal by payout
                    amount)
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="early-payout-req-reason">Reason (optional)</Label>
                  <Input
                    id="early-payout-req-reason"
                    placeholder="Optional note"
                    {...registerEarlyRequest("reason")}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createEarlyPayoutRequestMutation.isPending || !selectedFdId}
                  >
                    Submit request
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {transactionFormBody}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

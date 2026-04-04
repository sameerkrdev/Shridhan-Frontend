import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateRdFineWaiveRequestMutation,
  usePreviewRdPaymentMutation,
  usePayRdMutation,
} from "@/hooks/useRdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/components/Can";
import { useAuthSessionStore } from "@/store/authSessionStore";

interface RdPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  rdId: string;
}

export const RdPayDialog = ({ open, onOpenChange, societyId, rdId }: RdPayDialogProps) => {
  const [amount, setAmount] = useState("");
  const [monthsInput, setMonthsInput] = useState("");
  const [skipFinePolicy, setSkipFinePolicy] = useState<"none" | "all" | "selected">("none");
  const [skipFineMonthsInput, setSkipFineMonthsInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CASH" | "CHEQUE">("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");

  const previewMutation = usePreviewRdPaymentMutation(societyId, rdId);
  const payMutation = usePayRdMutation(societyId, rdId);
  const createWaiveRequestMutation = useCreateRdFineWaiveRequestMutation(societyId, rdId);
  const permissions = useAuthSessionStore((s) => s.selectedMembership?.permissions ?? []);
  const canSkipFine = hasPermission(permissions, "recurring_deposit.pay_skip_fine");
  const canRequestWaive = hasPermission(permissions, "recurring_deposit.request_fine_waive");
  const canApproveWaive = hasPermission(permissions, "recurring_deposit.approve_fine_waive");
  const [waiveScope, setWaiveScope] = useState<"none" | "all" | "selected">("none");
  const [waiveMonthsInput, setWaiveMonthsInput] = useState("");
  const [waiveReason, setWaiveReason] = useState("");
  const [waiveTtlDays, setWaiveTtlDays] = useState("7");
  const [reduceFromMaturity, setReduceFromMaturity] = useState(false);

  const preview = previewMutation.data;

  const monthsParsed = useMemo(() => {
    const raw = monthsInput.trim();
    if (!raw) return undefined;
    return raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
  }, [monthsInput]);

  const skipFineMonthsParsed = useMemo(() => {
    const raw = skipFineMonthsInput.trim();
    if (!raw) return undefined;
    return raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0);
  }, [skipFineMonthsInput]);

  useEffect(() => {
    if (!open) {
      setAmount("");
      setMonthsInput("");
      setSkipFinePolicy("none");
      setSkipFineMonthsInput("");
      setPaymentMethod("CASH");
      setTransactionId("");
      setUpiId("");
      setBankName("");
      setChequeNumber("");
      setWaiveScope("none");
      setWaiveMonthsInput("");
      setWaiveReason("");
      setWaiveTtlDays("7");
      setReduceFromMaturity(false);
      previewMutation.reset();
      return;
    }

    const t = window.setTimeout(() => {
      const num = Number(amount);
      void previewMutation.mutate({
        amount: amount.trim() === "" || Number.isNaN(num) ? undefined : num,
        months: monthsParsed?.length ? monthsParsed : undefined,
        skipFinePolicy:
          waiveScope === "none"
            ? canSkipFine
              ? skipFinePolicy
              : "none"
            : waiveScope,
        skipFineMonths:
          waiveScope === "selected"
            ? (waiveMonthsInput.trim()
                ? waiveMonthsInput.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n) && n > 0)
                : undefined)
            : canSkipFine && skipFinePolicy === "selected" && skipFineMonthsParsed?.length
              ? skipFineMonthsParsed
              : undefined,
      });
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce preview
  }, [
    open,
    amount,
    monthsInput,
    skipFinePolicy,
    skipFineMonthsInput,
    societyId,
    rdId,
    canSkipFine,
    waiveScope,
    waiveMonthsInput,
  ]);

  const maxDueNum = preview ? Number(preview.maxDue) : NaN;
  const amountNum = Number(amount);
  const amountValid =
    amount.trim() !== "" &&
    !Number.isNaN(amountNum) &&
    amountNum > 0 &&
    !Number.isNaN(maxDueNum) &&
    amountNum <= maxDueNum;

  const canSubmit =
    amountValid &&
    (skipFinePolicy !== "selected" || (skipFineMonthsParsed?.length ?? 0) > 0) &&
    (waiveScope !== "selected" ||
      waiveMonthsInput
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0).length > 0) &&
    (paymentMethod === "CASH" ||
      (paymentMethod === "UPI" && transactionId.trim() && upiId.trim()) ||
      (paymentMethod === "CHEQUE" && bankName.trim() && chequeNumber.trim()));

  const handlePay = async () => {
    if (!canSubmit) return;
    try {
      let waiveRequestId: string | undefined;
      if (canRequestWaive && waiveScope !== "none") {
        const selectedMonths =
          waiveScope === "selected"
            ? waiveMonthsInput
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => !Number.isNaN(n) && n > 0)
            : undefined;
        const request = await createWaiveRequestMutation.mutateAsync({
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

      await payMutation.mutateAsync({
        amount: amountNum,
        months: monthsParsed?.length ? monthsParsed : undefined,
        skipFinePolicy: canSkipFine ? skipFinePolicy : "none",
        skipFineMonths:
          canSkipFine && skipFinePolicy === "selected" && skipFineMonthsParsed?.length
            ? skipFineMonthsParsed
            : undefined,
        waiveRequestId,
        paymentMethod,
        transactionId: transactionId.trim() || undefined,
        upiId: upiId.trim() || undefined,
        bankName: bankName.trim() || undefined,
        chequeNumber: chequeNumber.trim() || undefined,
      });
      toast.success("Payment recorded");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Payment failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Record RD payment</DialogTitle>
          <DialogDescription>
            Preview is computed on the server. Amount cannot exceed total due for the selected scope.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Months scope (optional, comma-separated)</Label>
            <Input
              placeholder="e.g. 1,2,3"
              value={monthsInput}
              onChange={(e) => setMonthsInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {preview ? (
              <p className="text-xs text-muted-foreground">
                Max due: Rs. {Number(preview.maxDue).toFixed(2)} (preview for this scope)
              </p>
            ) : null}
          </div>

          {canSkipFine ? (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Fine handling</Label>
              <Select value={skipFinePolicy} onValueChange={(v) => setSkipFinePolicy(v as typeof skipFinePolicy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Standard (collect fines now)</SelectItem>
                  <SelectItem value="all">Skip fine for all due months in scope</SelectItem>
                  <SelectItem value="selected">Skip fine for selected months</SelectItem>
                </SelectContent>
              </Select>
              {skipFinePolicy === "selected" ? (
                <Input
                  placeholder="Skip-fine month indexes (e.g. 1,2,3)"
                  value={skipFineMonthsInput}
                  onChange={(e) => setSkipFineMonthsInput(e.target.value)}
                />
              ) : null}
              <p className="text-xs text-muted-foreground">
                Skipped fines are deferred and deducted during maturity withdrawal.
              </p>
            </div>
          ) : null}

          {canRequestWaive ? (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Fine waive-off request</Label>
              <Select value={waiveScope} onValueChange={(v) => setWaiveScope(v as typeof waiveScope)}>
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

          {previewMutation.isPending ? (
            <p className="text-sm text-muted-foreground">Updating preview...</p>
          ) : preview ? (
            <div className="rounded-md border p-3 text-sm space-y-1 max-h-[160px] overflow-y-auto">
              <p className="font-medium">Allocation preview</p>
              {preview.allocations.length === 0 ? (
                <p className="text-muted-foreground">Enter amount to see allocation.</p>
              ) : (
                preview.allocations.map((a, idx) => (
                  <div key={`${a.installmentId}-${a.monthIndex}-${idx}`} className="flex justify-between gap-2">
                    <span>
                      Month {a.monthIndex}: principal {a.principalApplied}, fine {a.fineApplied}
                    </span>
                  </div>
                ))
              )}
              {preview.deferredFineDeltas.length ? (
                <div className="border-t pt-2">
                  <p className="font-medium">Deferred fine preview</p>
                  {preview.deferredFineDeltas.map((d, idx) => (
                    <p key={`${d.installmentId}-${d.monthIndex}-${idx}`} className="text-muted-foreground">
                      Month {d.monthIndex}: deferred fine {d.deferredFineDelta}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CHEQUE">CHEQUE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Transaction ID" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
            <Input placeholder="UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <Input placeholder="Cheque number" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || payMutation.isPending} onClick={handlePay}>
            {payMutation.isPending || createWaiveRequestMutation.isPending
              ? "Saving..."
              : "Submit payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

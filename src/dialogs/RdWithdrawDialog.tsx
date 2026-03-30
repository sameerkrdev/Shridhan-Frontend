import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useWithdrawRdMutation } from "@/hooks/useRdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

interface RdWithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  rdId: string;
  summary?: {
    grossMaturityPayout?: string;
    totalDeferredFines?: string;
    netMaturityPayoutAfterDeferredFines?: string;
  };
}

export const RdWithdrawDialog = ({ open, onOpenChange, societyId, rdId, summary }: RdWithdrawDialogProps) => {
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CASH" | "CHEQUE">("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const totalDeferred = Number(summary?.totalDeferredFines ?? "0");
  const hasDeferredFines = totalDeferred > 0;
  const [deductDeferredFinesFromMaturity, setDeductDeferredFinesFromMaturity] = useState(hasDeferredFines);
  const mutation = useWithdrawRdMutation(societyId, rdId);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPaymentMethod("CASH");
      setTransactionId("");
      setUpiId("");
      setBankName("");
      setChequeNumber("");
      setDeductDeferredFinesFromMaturity(hasDeferredFines);
    }
    onOpenChange(nextOpen);
  };

  const canSubmit =
    paymentMethod === "CASH" ||
    (paymentMethod === "UPI" && transactionId.trim() && upiId.trim()) ||
    (paymentMethod === "CHEQUE" && bankName.trim() && chequeNumber.trim());

  const onSubmit = async () => {
    if (!canSubmit) return;
    try {
      await mutation.mutateAsync({
        deductDeferredFinesFromMaturity,
        paymentMethod,
        transactionId: transactionId.trim() || undefined,
        upiId: upiId.trim() || undefined,
        bankName: bankName.trim() || undefined,
        chequeNumber: chequeNumber.trim() || undefined,
      });
      toast.success("Withdrawal recorded");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Withdrawal failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Maturity withdrawal</DialogTitle>
          <DialogDescription>
            Allowed only after maturity date and when all installments are fully paid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border p-3 space-y-1 text-sm">
            <p className="flex justify-between gap-2">
              <span>Gross maturity amount</span>
              <span>Rs. {Number(summary?.grossMaturityPayout ?? "0").toFixed(2)}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span>Deferred fines</span>
              <span>Rs. {Number(summary?.totalDeferredFines ?? "0").toFixed(2)}</span>
            </p>
            <p className="flex justify-between gap-2 font-medium">
              <span>Net payout preview</span>
              <span>Rs. {Number(summary?.netMaturityPayoutAfterDeferredFines ?? "0").toFixed(2)}</span>
            </p>
          </div>
          {hasDeferredFines ? (
            <label className="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                checked={deductDeferredFinesFromMaturity}
                onCheckedChange={(checked) => setDeductDeferredFinesFromMaturity(checked === true)}
              />
              <span className="text-sm">Deduct deferred penalties from maturity payout</span>
            </label>
          ) : null}
          <div className="space-y-2">
            <Label>Payout method</Label>
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
          <Button type="button" disabled={!canSubmit || mutation.isPending} onClick={onSubmit}>
            {mutation.isPending ? "Processing..." : "Confirm withdrawal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequiredLabel } from "@/components/ui/required-label";
import { useAddMisDepositMutation } from "@/hooks/useMisApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

const schema = z
  .object({
    amount: z.number().min(1, "Amount must be greater than 0"),
    paymentMethod: z.enum(["UPI", "CASH", "CHEQUE"]).optional(),
    transactionId: z.string().optional(),
    upiId: z.string().optional(),
    bankName: z.string().optional(),
    chequeNumber: z.string().optional(),
  })
  .superRefine((payload, ctx) => {
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

interface AddMisDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  misId: string;
}

export const AddMisDepositDialog = ({ open, onOpenChange, societyId, misId }: AddMisDepositDialogProps) => {
  const mutation = useAddMisDepositMutation(societyId, misId);
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
      amount: 0,
      paymentMethod: "CASH",
      transactionId: "",
      upiId: "",
      bankName: "",
      chequeNumber: "",
    },
  });

  const paymentMethod = watch("paymentMethod");

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync(values);
      toast.success("Deposit recorded");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to record deposit"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Record Deposit</DialogTitle>
          <DialogDescription>Add a deposit payment for this MIS account.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel>Amount</RequiredLabel>
            <Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
            {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
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
              Save Deposit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

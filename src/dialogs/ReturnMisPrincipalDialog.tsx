import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequiredLabel } from "@/components/ui/required-label";
import { useReturnMisPrincipalMutation } from "@/hooks/useMisApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

interface ReturnMisPrincipalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  misId: string;
}

interface FormData {
  paymentMethod?: "UPI" | "CASH" | "CHEQUE";
  transactionId?: string;
  upiId?: string;
  bankName?: string;
  chequeNumber?: string;
}

export const ReturnMisPrincipalDialog = ({
  open,
  onOpenChange,
  societyId,
  misId,
}: ReturnMisPrincipalDialogProps) => {
  const mutation = useReturnMisPrincipalMutation(societyId, misId);
  const { register, watch, setValue, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
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
      toast.success("Principal returned and account closed");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to return principal"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Return Principal</DialogTitle>
          <DialogDescription>Close MIS account by returning principal amount.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
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
              </div>
              <div className="space-y-2">
                <RequiredLabel>UPI ID</RequiredLabel>
                <Input {...register("upiId")} />
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
              Return Principal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

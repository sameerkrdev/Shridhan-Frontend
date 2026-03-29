import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequiredLabel } from "@/components/ui/required-label";
import { SearchableSingleSelectAsync } from "@/components/ui/searchable-single-select";
import type { RdProjectType } from "@/lib/rdApi";
import { useCreateRdAccountMutation, useRdReferrerMembersQuery } from "@/hooks/useRdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

const schema = z
  .object({
    referrerMembershipId: z.string().optional(),
    customer: z.object({
      fullName: z.string().trim().min(2, "Full name is required").max(150),
      phone: z.string().regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian number"),
      email: z.string().email("Invalid email").optional().or(z.literal("")),
      address: z.string().max(500).optional(),
      aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits").optional().or(z.literal("")),
      pan: z
        .string()
        .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, "PAN must be valid")
        .optional()
        .or(z.literal("")),
    }),
    nominees: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Nominee name is required").max(150),
          phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone"),
          relation: z.string().trim().min(2, "Relation is required").max(120),
          address: z.string().max(500).optional(),
          aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits").optional().or(z.literal("")),
          pan: z
            .string()
            .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, "PAN must be valid")
            .optional()
            .or(z.literal("")),
        }),
      )
      .min(1)
      .max(5),
    rd: z.object({
      projectTypeId: z.string().uuid("Project type is required"),
      monthlyAmount: z.number().min(1, "Monthly amount must be greater than 0"),
      startDate: z.string().min(1, "Start date is required"),
    }),
    payment: z.object({
      amount: z.number().min(0).optional(),
      paymentMethod: z.enum(["UPI", "CASH", "CHEQUE"]).optional(),
      transactionId: z.string().optional(),
      upiId: z.string().optional(),
      bankName: z.string().optional(),
      chequeNumber: z.string().optional(),
    }),
  })
  .superRefine((payload, ctx) => {
    if (payload.payment.amount !== undefined && payload.payment.amount > 0 && !payload.payment.paymentMethod) {
      ctx.addIssue({
        code: "custom",
        path: ["payment", "paymentMethod"],
        message: "Payment method is required when amount is set",
      });
    }
    if (payload.payment.paymentMethod === "UPI") {
      if (!payload.payment.upiId) {
        ctx.addIssue({ code: "custom", path: ["payment", "upiId"], message: "UPI ID is required" });
      }
      if (!payload.payment.transactionId) {
        ctx.addIssue({ code: "custom", path: ["payment", "transactionId"], message: "Transaction ID is required" });
      }
    }
    if (payload.payment.paymentMethod === "CHEQUE") {
      if (!payload.payment.bankName) {
        ctx.addIssue({ code: "custom", path: ["payment", "bankName"], message: "Bank name is required" });
      }
      if (!payload.payment.chequeNumber) {
        ctx.addIssue({ code: "custom", path: ["payment", "chequeNumber"], message: "Cheque number is required" });
      }
    }
    const phones = payload.nominees.map((n) => n.phone);
    if (new Set(phones).size !== phones.length) {
      ctx.addIssue({ code: "custom", path: ["nominees"], message: "Nominee phone numbers must be unique" });
    }
  });

type FormData = z.infer<typeof schema>;

interface CreateRdAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  projectTypes: RdProjectType[];
}

export const CreateRdAccountDialog = ({
  open,
  onOpenChange,
  societyId,
  projectTypes,
}: CreateRdAccountDialogProps) => {
  const mutation = useCreateRdAccountMutation(societyId);
  const { data: referrerMembers } = useRdReferrerMembersQuery(societyId);
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      referrerMembershipId: "",
      customer: {
        fullName: "",
        phone: "",
        email: "",
        address: "",
        aadhaar: "",
        pan: "",
      },
      nominees: [{ name: "", phone: "", relation: "", address: "", aadhaar: "", pan: "" }],
      rd: {
        projectTypeId: "",
        monthlyAmount: 5000,
        startDate: new Date().toISOString().slice(0, 10),
      },
      payment: {
        amount: undefined,
        paymentMethod: "CASH",
        transactionId: "",
        upiId: "",
        bankName: "",
        chequeNumber: "",
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "nominees",
  });

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const existing = getValues("rd.projectTypeId");
    if (!existing && projectTypes.length > 0) {
      setValue("rd.projectTypeId", projectTypes[0].id, { shouldDirty: false });
    }
  }, [open, projectTypes, reset, setValue, getValues]);

  const referrerOptions = [
    { value: "none", label: "No referrer" },
    ...(referrerMembers ?? []).map((m) => ({
      value: m.id,
      label: `${m.user.name} - ${m.role.name} (${m.user.phone})`,
    })),
  ];

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync({
        referrerMembershipId:
          values.referrerMembershipId && values.referrerMembershipId !== "none"
            ? values.referrerMembershipId
            : undefined,
        customer: {
          ...values.customer,
          email: values.customer.email || undefined,
        },
        nominees: values.nominees,
        rd: {
          projectTypeId: values.rd.projectTypeId,
          monthlyAmount: values.rd.monthlyAmount,
          startDate: new Date(values.rd.startDate).toISOString(),
        },
        payment:
          values.payment.amount !== undefined && values.payment.amount > 0
            ? {
                amount: values.payment.amount,
                paymentMethod: values.payment.paymentMethod,
                transactionId: values.payment.transactionId || undefined,
                upiId: values.payment.upiId || undefined,
                bankName: values.payment.bankName || undefined,
                chequeNumber: values.payment.chequeNumber || undefined,
              }
            : undefined,
      });
      toast.success("RD account created");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create RD account"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Create RD Account</DialogTitle>
          <DialogDescription>Customer, nominees, installments, and optional first payment.</DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label>Referrer Member</Label>
            <SearchableSingleSelectAsync
              value={watch("referrerMembershipId") || "none"}
              onChange={(v) => setValue("referrerMembershipId", v === "none" ? "" : v)}
              options={referrerOptions}
              placeholder="Select referrer"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel>Customer name</RequiredLabel>
              <Input {...register("customer.fullName")} />
              {errors.customer?.fullName ? (
                <p className="text-sm text-destructive">{errors.customer.fullName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel>Phone</RequiredLabel>
              <Input {...register("customer.phone")} />
              {errors.customer?.phone ? (
                <p className="text-sm text-destructive">{errors.customer.phone.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Project type</Label>
              <Select value={watch("rd.projectTypeId")} onValueChange={(v) => setValue("rd.projectTypeId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes
                    .filter((p) => !p.isDeleted && !p.isArchived)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.duration} mo)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {errors.rd?.projectTypeId ? (
                <p className="text-sm text-destructive">{errors.rd.projectTypeId.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel>Monthly amount</RequiredLabel>
              <Input type="number" step="0.01" {...register("rd.monthlyAmount", { valueAsNumber: true })} />
              {errors.rd?.monthlyAmount ? (
                <p className="text-sm text-destructive">{errors.rd.monthlyAmount.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <RequiredLabel>Start date</RequiredLabel>
            <Input type="date" {...register("rd.startDate")} />
            {errors.rd?.startDate ? <p className="text-sm text-destructive">{errors.rd.startDate.message}</p> : null}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold">Nominees</h3>
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 sm:grid-cols-2 border-b pb-3">
                <Input placeholder="Name" {...register(`nominees.${index}.name` as const)} />
                <Input placeholder="Phone" {...register(`nominees.${index}.phone` as const)} />
                <Input placeholder="Relation" {...register(`nominees.${index}.relation` as const)} />
                <div className="flex items-end gap-2">
                  {fields.length > 1 ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {errors.nominees?.root ? (
              <p className="text-sm text-destructive">{errors.nominees.root.message}</p>
            ) : null}
            {fields.length < 5 ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => append({ name: "", phone: "", relation: "", address: "", aadhaar: "", pan: "" })}>
                Add nominee
              </Button>
            ) : null}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold">Optional initial payment</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.01" {...register("payment.amount", { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={watch("payment.paymentMethod") ?? "CASH"}
                  onValueChange={(v) => setValue("payment.paymentMethod", v as FormData["payment"]["paymentMethod"])}
                >
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Transaction ID" {...register("payment.transactionId")} />
              <Input placeholder="UPI ID" {...register("payment.upiId")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Bank name" {...register("payment.bankName")} />
              <Input placeholder="Cheque number" {...register("payment.chequeNumber")} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

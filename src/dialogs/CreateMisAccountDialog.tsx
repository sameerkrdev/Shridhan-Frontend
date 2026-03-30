import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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
import { completeMisDocumentUpload, type MisProjectType } from "@/lib/misApi";
import { useCreateMisAccountMutation, useMisReferrerMembersQuery } from "@/hooks/useMisApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/dateFormat";

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
        .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, "PAN must be valid (ABCDE1234F)")
        .optional()
        .or(z.literal("")),
    }),
    nominees: z
      .array(
        z.object({
          name: z.string().trim().min(2, "Nominee name is required").max(150),
          phone: z.string().regex(/^[6-9]\d{9}$/, "Nominee phone must be a valid 10-digit Indian number"),
          relation: z.string().optional(),
          customRelation: z.string().optional(),
          address: z.string().max(500).optional(),
          aadhaar: z.string().regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits").optional().or(z.literal("")),
          pan: z
            .string()
            .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, "PAN must be valid (ABCDE1234F)")
            .optional()
            .or(z.literal("")),
        }),
      )
      .min(1, "At least one nominee is required")
      .max(5, "You can add up to 5 nominees only"),
    mis: z.object({
      projectTypeId: z.string().uuid("Project type is required"),
      depositAmount: z.number().min(1, "Deposit amount must be greater than 0"),
      startDate: z.string().min(1, "Start date is required"),
    }),
    payment: z.object({
      amount: z.number().min(0, "Payment amount cannot be negative").optional(),
      paymentMethod: z.enum(["UPI", "CASH", "CHEQUE"]).optional(),
      transactionId: z.string().optional(),
      upiId: z.string().optional(),
      bankName: z.string().optional(),
      chequeNumber: z.string().optional(),
    }),
  })
  .superRefine((payload, ctx) => {
    if (payload.payment.amount !== undefined && payload.payment.amount > payload.mis.depositAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["payment", "amount"],
        message: "Initial payment cannot exceed deposit amount",
      });
    }
    if (payload.payment.paymentMethod === "UPI") {
      if (!payload.payment.upiId) {
        ctx.addIssue({ code: "custom", path: ["payment", "upiId"], message: "UPI ID is required for UPI payments" });
      }
      if (!payload.payment.transactionId) {
        ctx.addIssue({
          code: "custom",
          path: ["payment", "transactionId"],
          message: "Transaction ID is required for UPI payments",
        });
      }
    }
    if (payload.payment.paymentMethod === "CHEQUE") {
      if (!payload.payment.bankName) {
        ctx.addIssue({ code: "custom", path: ["payment", "bankName"], message: "Bank name is required for cheque payments" });
      }
      if (!payload.payment.chequeNumber) {
        ctx.addIssue({
          code: "custom",
          path: ["payment", "chequeNumber"],
          message: "Cheque number is required for cheque payments",
        });
      }
    }

    payload.nominees.forEach((nominee, index) => {
      if (!nominee.relation) {
        ctx.addIssue({
          code: "custom",
          path: ["nominees", index, "relation"],
          message: "Relation is required",
        });
      }
      if (nominee.relation === "OTHER" && !nominee.customRelation?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["nominees", index, "customRelation"],
          message: "Custom relation is required",
        });
      }
    });

    const nomineePhones = payload.nominees.map((nominee) => nominee.phone);
    if (new Set(nomineePhones).size !== nomineePhones.length) {
      ctx.addIssue({
        code: "custom",
        path: ["nominees"],
        message: "Nominee phone numbers must be unique",
      });
    }
  });

type FormData = z.infer<typeof schema>;

const getMonthlyPayoutForProjectType = (projectType: MisProjectType, depositAmount: number) => {
  if (projectType.calculationMethod === "ANNUAL_INTEREST_RATE") {
    const annualRate = Number(projectType.annualInterestRate ?? 0);
    return (depositAmount * annualRate) / 100 / 12;
  }
  const perHundred = Number(projectType.monthlyPayoutAmountPerHundred ?? 0);
  return (depositAmount / 100) * perHundred;
};

interface CreateMisAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  projectTypes: MisProjectType[];
}

const formatCurrency = (value: number) => `Rs. ${value.toFixed(2)}`;
const RELATION_OPTIONS = [
  "FATHER",
  "MOTHER",
  "SPOUSE",
  "SON",
  "DAUGHTER",
  "BROTHER",
  "SISTER",
  "HUSBAND",
  "WIFE",
  "GUARDIAN",
  "OTHER",
] as const;

export const CreateMisAccountDialog = ({
  open,
  onOpenChange,
  societyId,
  projectTypes,
}: CreateMisAccountDialogProps) => {
  const mutation = useCreateMisAccountMutation(societyId);
  const { data: referrerMembers } = useMisReferrerMembersQuery(societyId);
  const [documents, setDocuments] = useState<Array<{ file: File; displayName: string }>>([]);
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    handleSubmit,
    reset,
    setError,
    clearErrors,
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
      nominees: [{ name: "", phone: "", relation: "", customRelation: "", address: "", aadhaar: "", pan: "" }],
      mis: {
        projectTypeId: "",
        depositAmount: 100000,
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
      setDocuments([]);
      return;
    }
    const existingProjectTypeId = getValues("mis.projectTypeId");
    if (!existingProjectTypeId && projectTypes.length > 0) {
      setValue("mis.projectTypeId", projectTypes[0].id, { shouldDirty: false });
    }
  }, [getValues, open, projectTypes, reset, setValue]);

  const selectedProjectTypeId = watch("mis.projectTypeId");
  const depositAmount = watch("mis.depositAmount") ?? 0;
  const startDate = watch("mis.startDate");
  const initialPaymentAmount = watch("payment.amount") ?? 0;
  const paymentMethod = watch("payment.paymentMethod");
  const nomineeValues = watch("nominees");

  const selectedProjectType = useMemo(
    () => projectTypes.find((projectType) => projectType.id === selectedProjectTypeId),
    [projectTypes, selectedProjectTypeId],
  );
  const referrerOptions = useMemo(
    () => [
      { value: "none", label: "No referrer" },
      ...(referrerMembers ?? []).map((member) => ({
        value: member.id,
        label: `${member.user.name} - ${member.role.name} (${member.user.phone})`,
      })),
    ],
    [referrerMembers],
  );

  const monthlyInterestPreview = useMemo(() => {
    if (!selectedProjectType) return 0;
    return getMonthlyPayoutForProjectType(selectedProjectType, depositAmount);
  }, [depositAmount, selectedProjectType]);

  const maturityDatePreview = useMemo(() => {
    if (!selectedProjectType || !startDate) return "";
    const dt = new Date(startDate);
    dt.setMonth(dt.getMonth() + selectedProjectType.duration);
    return dt.toISOString();
  }, [selectedProjectType, startDate]);

  const schedulePreview = useMemo(() => {
    if (!selectedProjectType) return [];
    return Array.from({ length: selectedProjectType.duration }).map((_, index) => ({
      month: index + 1,
      amount: monthlyInterestPreview,
    }));
  }, [monthlyInterestPreview, selectedProjectType]);

  const selectedProjectTypeMinimumAmount = useMemo(
    () => Number(selectedProjectType?.minimumAmount ?? 0),
    [selectedProjectType],
  );
  const interestTypePreview = useMemo(() => {
    if (!selectedProjectType) return "N/A";
    if (selectedProjectType.calculationMethod === "ANNUAL_INTEREST_RATE") {
      const annualRate = Number(selectedProjectType.annualInterestRate ?? 0);
      return `Annual Interest Rate (${annualRate.toFixed(2)}%)`;
    }
    const perHundred = Number(selectedProjectType.monthlyPayoutAmountPerHundred ?? 0);
    return `Monthly Amount Per Hundred (${perHundred.toFixed(2)})`;
  }, [selectedProjectType]);
  const totalInterestPreview = useMemo(
    () => (selectedProjectType ? monthlyInterestPreview * selectedProjectType.duration : 0),
    [monthlyInterestPreview, selectedProjectType],
  );
  const totalReturnPreview = useMemo(
    () => Number(depositAmount || 0) + totalInterestPreview,
    [depositAmount, totalInterestPreview],
  );

  useEffect(() => {
    if (!selectedProjectType) return;
    if (depositAmount < selectedProjectTypeMinimumAmount) {
      setError("mis.depositAmount", {
        type: "manual",
        message: `Deposit amount must be greater than or equal to minimum amount (${selectedProjectTypeMinimumAmount.toFixed(2)})`,
      });
      return;
    }
    if (errors.mis?.depositAmount?.type === "manual") {
      clearErrors("mis.depositAmount");
    }
  }, [
    clearErrors,
    depositAmount,
    errors.mis?.depositAmount?.type,
    selectedProjectType,
    selectedProjectTypeMinimumAmount,
    setError,
  ]);

  const onSubmit = async (values: FormData) => {
    if (selectedProjectType && values.mis.depositAmount < selectedProjectTypeMinimumAmount) {
      setError("mis.depositAmount", {
        type: "manual",
        message: `Deposit amount must be greater than or equal to minimum amount (${selectedProjectTypeMinimumAmount.toFixed(2)})`,
      });
      return;
    }

    try {
      const created = await mutation.mutateAsync({
        referrerMembershipId:
          values.referrerMembershipId && values.referrerMembershipId !== "none"
            ? values.referrerMembershipId
            : undefined,
        customer: {
          ...values.customer,
          email: values.customer.email || undefined,
        },
        nominees: values.nominees.map((nominee) => {
          const { customRelation, ...rest } = nominee;
          return {
            ...rest,
            relation: nominee.relation === "OTHER" ? (customRelation?.trim() ?? "") : nominee.relation,
          };
        }),
        mis: {
          ...values.mis,
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
        documents: documents.map((item) => ({
          fileName: item.file.name,
          displayName: item.displayName || item.file.name,
          contentType: item.file.type || undefined,
          sizeBytes: item.file.size,
        })),
      });

      if (created.uploadTargets?.length) {
        await Promise.all(
          created.uploadTargets.map(async (target) => {
            const source = documents.find(
              (item) => item.file.name === target.fileName && item.displayName === target.displayName,
            );
            if (!source) return;

            await fetch(target.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": source.file.type || "application/octet-stream" },
              body: source.file,
            });
            await completeMisDocumentUpload(societyId, created.id, target.documentId);
          }),
        );
      }

      toast.success("MIS account created");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create MIS account"));
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    setDocuments((prev) => [...prev, ...selected.map((file) => ({ file, displayName: file.name }))]);
    event.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>Create MIS Account</DialogTitle>
          <DialogDescription>
            Customer, nominee, MIS account, and initial deposit transaction will be created together.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label>Referrer Member</Label>
            <SearchableSingleSelectAsync
              value={watch("referrerMembershipId") || "none"}
              onChange={(value) =>
                setValue("referrerMembershipId", value === "none" ? "" : value, { shouldValidate: true })
              }
              options={referrerOptions}
              placeholder="Select referrer member (optional)"
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Customer Info</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>Full Name</RequiredLabel>
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
              <div className="space-y-2">
                <Label>Email</Label>
                <Input {...register("customer.email")} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input {...register("customer.address")} />
              </div>
              <div className="space-y-2">
                <Label>Aadhaar</Label>
                <Input {...register("customer.aadhaar")} />
                {errors.customer?.aadhaar ? (
                  <p className="text-sm text-destructive">{errors.customer.aadhaar.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>PAN</Label>
                <Input
                  {...register("customer.pan")}
                  maxLength={10}
                  onInput={(event) => {
                    const target = event.currentTarget;
                    target.value = target.value.toUpperCase();
                  }}
                />
                {errors.customer?.pan ? (
                  <p className="text-sm text-destructive">{errors.customer.pan.message}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Nominee Info</h3>
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Nominee #{index + 1}</p>
                  {fields.length > 1 ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <RequiredLabel>Name</RequiredLabel>
                    <Input {...register(`nominees.${index}.name`)} />
                    {errors.nominees?.[index]?.name ? (
                      <p className="text-sm text-destructive">{errors.nominees[index]?.name?.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel>Phone</RequiredLabel>
                    <Input {...register(`nominees.${index}.phone`)} />
                    {errors.nominees?.[index]?.phone ? (
                      <p className="text-sm text-destructive">{errors.nominees[index]?.phone?.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel>Relation</RequiredLabel>
                    <Select
                      value={nomineeValues?.[index]?.relation ?? ""}
                      onValueChange={(value) =>
                        setValue(`nominees.${index}.relation`, value, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select relation" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATION_OPTIONS.map((relation) => (
                          <SelectItem key={relation} value={relation}>
                            {relation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {nomineeValues?.[index]?.relation === "OTHER" ? (
                    <div className="space-y-2">
                      <Label>Custom Relation</Label>
                      <Input {...register(`nominees.${index}.customRelation`)} />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input {...register(`nominees.${index}.address`)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Aadhaar</Label>
                    <Input {...register(`nominees.${index}.aadhaar`)} />
                    {errors.nominees?.[index]?.aadhaar ? (
                      <p className="text-sm text-destructive">{errors.nominees[index]?.aadhaar?.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>PAN</Label>
                    <Input
                      {...register(`nominees.${index}.pan`)}
                      maxLength={10}
                      onInput={(event) => {
                        const target = event.currentTarget;
                        target.value = target.value.toUpperCase();
                      }}
                    />
                    {errors.nominees?.[index]?.pan ? (
                      <p className="text-sm text-destructive">{errors.nominees[index]?.pan?.message}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({ name: "", phone: "", relation: "", customRelation: "", address: "", aadhaar: "", pan: "" })
              }
            >
              Add Nominee
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">MIS Details</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <RequiredLabel>Project Type</RequiredLabel>
                <Select
                  value={selectedProjectTypeId}
                  onValueChange={(value) => setValue("mis.projectTypeId", value, { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((projectType) => (
                      <SelectItem key={projectType.id} value={projectType.id}>
                        {projectType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.mis?.projectTypeId ? (
                  <p className="text-sm text-destructive">{errors.mis.projectTypeId.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel>Deposit Amount</RequiredLabel>
                <Input type="number" step="0.01" {...register("mis.depositAmount", { valueAsNumber: true })} />
                {errors.mis?.depositAmount ? (
                  <p className="text-sm text-destructive">{errors.mis.depositAmount.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel>Start Date</RequiredLabel>
                <Input type="date" {...register("mis.startDate")} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Payment Info</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>Initial Payment Amount</RequiredLabel>
                <Input type="number" step="0.01" {...register("payment.amount", { valueAsNumber: true })} />
                {errors.payment?.amount ? (
                  <p className="text-sm text-destructive">{errors.payment.amount.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel>Payment Method</RequiredLabel>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setValue("payment.paymentMethod", value as "UPI" | "CASH" | "CHEQUE", {
                      shouldValidate: true,
                    })
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
                  <Input {...register("payment.transactionId")} />
                </div>
              )}
              {paymentMethod === "UPI" && (
                <div className="space-y-2">
                  <Label>UPI ID</Label>
                  <Input {...register("payment.upiId")} />
                </div>
              )}
              {paymentMethod === "CHEQUE" && (
                <>
                  <div className="space-y-2">
                    <Label>Cheque Number</Label>
                    <Input {...register("payment.chequeNumber")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input {...register("payment.bankName")} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Documents</h3>
            <Input type="file" multiple onChange={handleFilesSelected} />
            {documents.length > 0 ? (
              <div className="space-y-2">
                {documents.map((document, index) => (
                  <div key={`${document.file.name}-${index}`} className="rounded-md border p-2 space-y-2">
                    <p className="text-xs text-muted-foreground">Original: {document.file.name}</p>
                    <div className="flex gap-2">
                      <Input
                        value={document.displayName}
                        onChange={(event) =>
                          setDocuments((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, displayName: event.target.value } : item,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDocuments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected Project Type</p>
              <div className="rounded-md border bg-background px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Name</span><span className="font-medium text-right">{selectedProjectType?.name ?? "N/A"}</span></div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Duration</span><span className="font-medium text-right">{selectedProjectType ? `${selectedProjectType.duration} months` : "N/A"}</span></div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Minimum Amount</span><span className="font-medium text-right">{formatCurrency(selectedProjectTypeMinimumAmount)}</span></div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Interest Config</span><span className="font-medium text-right">{interestTypePreview}</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calculation Preview</p>
              <div className="rounded-md border bg-background px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Monthly Interest</span><span className="font-semibold text-right">{formatCurrency(monthlyInterestPreview)}</span></div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Maturity Date</span><span className="font-medium text-right">{maturityDatePreview ? formatDate(maturityDatePreview) : "N/A"}</span></div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Total Interest</span><span className="font-medium text-right">{formatCurrency(totalInterestPreview)}</span></div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Principal Return</span><span className="font-medium text-right">{formatCurrency(Number(depositAmount || 0))}</span></div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Total Return</span><span className="font-semibold text-right text-emerald-700">{formatCurrency(totalReturnPreview)}</span></div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2"><span className="text-muted-foreground">Remaining Deposit</span><span className="font-medium text-right">{formatCurrency(Math.max(0, depositAmount - initialPaymentAmount))}</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Future Interest Schedule</p>
              <div className="max-h-28 overflow-y-auto rounded-md border bg-background px-3 py-2 text-xs">
                {schedulePreview.length === 0 ? (
                  <p className="text-muted-foreground">Select project type to preview schedule.</p>
                ) : (
                  schedulePreview.map((entry) => (
                    <p key={entry.month}>
                      Month {entry.month}: {formatCurrency(entry.amount)}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || projectTypes.length === 0}>
              Create MIS Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

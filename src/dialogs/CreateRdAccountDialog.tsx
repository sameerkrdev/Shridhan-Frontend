import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import type { PaymentMethod, RdProjectType } from "@/lib/rdApi";
import { useCreateRdAccountMutation, useRdReferrerMembersQuery } from "@/hooks/useRdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import { formatDate } from "@/lib/dateFormat";

const schema = z
  .object({
    referrerMembershipId: z.string().min(1, "Referrer member is required"),
    customer: z.object({
      fullName: z.string().trim().min(2, "Full name is required").max(150),
      phone: z.string().regex(/^[6-9]\d{9}$/, "Phone must be a valid 10-digit Indian number"),
      email: z.string().email("Invalid email").optional().or(z.literal("")),
      address: z.string().max(500).optional(),
      aadhaar: z
        .string()
        .regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits")
        .optional()
        .or(z.literal("")),
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
          phone: z
            .string()
            .regex(/^[6-9]\d{9}$/, "Nominee phone must be a valid 10-digit Indian number"),
          relation: z.string().optional(),
          customRelation: z.string().optional(),
          address: z.string().max(500).optional(),
          aadhaar: z
            .string()
            .regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits")
            .optional()
            .or(z.literal("")),
          pan: z
            .string()
            .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, "PAN must be valid (ABCDE1234F)")
            .optional()
            .or(z.literal("")),
        }),
      )
      .min(1, "At least one nominee is required")
      .max(5, "You can add up to 5 nominees only"),
    rd: z.object({
      projectTypeId: z.string().min(1, "Project type is required"),
      monthlyAmount: z.number().min(1, "Monthly amount must be greater than 0"),
      startDate: z.string().min(1, "Start date is required"),
      initialPaymentAmount: z.number().min(0, "Initial payment cannot be negative"),
    }),
    payment: z.object({
      paymentMethod: z.enum(["UPI", "CASH", "CHEQUE"]),
      transactionId: z.string().optional(),
      upiId: z
        .string()
        .regex(/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/, "UPI ID is invalid")
        .optional()
        .or(z.literal("")),
      chequeNumber: z.string().optional(),
      bankName: z.string().optional(),
    }),
  })
  .superRefine((payload, ctx) => {
    if (payload.rd.initialPaymentAmount > 0) {
      if (payload.payment.paymentMethod === "UPI") {
        if (!payload.payment.upiId) {
          ctx.addIssue({
            code: "custom",
            path: ["payment", "upiId"],
            message: "UPI ID is required for UPI payment",
          });
        }
        if (!payload.payment.transactionId) {
          ctx.addIssue({
            code: "custom",
            path: ["payment", "transactionId"],
            message: "Transaction ID is required for UPI payment",
          });
        }
      }

      if (payload.payment.paymentMethod === "CHEQUE") {
        if (!payload.payment.chequeNumber?.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["payment", "chequeNumber"],
            message: "Cheque number is required for cheque payment",
          });
        }
        if (!payload.payment.bankName?.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["payment", "bankName"],
            message: "Bank name is required for cheque payment",
          });
        }
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

interface CreateRdAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
  projectTypes: RdProjectType[];
}

const getMaturityDate = (startDate: string, durationMonths: number) => {
  if (!startDate) return null;
  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setMonth(parsed.getMonth() + durationMonths);
  return parsed;
};

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

export const CreateRdAccountDialog = ({
  open,
  onOpenChange,
  societyId,
  projectTypes,
}: CreateRdAccountDialogProps) => {
  const mutation = useCreateRdAccountMutation(societyId);
  const { data: referrerMembers } = useRdReferrerMembersQuery(societyId);
  const [documents, setDocuments] = useState<Array<{ file: File; displayName: string }>>([]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
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
      nominees: [
        {
          name: "",
          phone: "",
          relation: "",
          customRelation: "",
          address: "",
          aadhaar: "",
          pan: "",
        },
      ],
      rd: {
        projectTypeId: "",
        monthlyAmount: undefined as unknown as number,
        startDate: "",
        initialPaymentAmount: 0,
      },
      payment: {
        paymentMethod: "CASH",
        transactionId: "",
        upiId: "",
        chequeNumber: "",
        bankName: "",
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
    }
  }, [open, reset]);

  const selectedProjectTypeId = watch("rd.projectTypeId");
  const monthlyAmount = watch("rd.monthlyAmount");
  const initialPaymentAmount = watch("rd.initialPaymentAmount");
  const startDate = watch("rd.startDate");
  const paymentMethod = watch("payment.paymentMethod");
  const nomineeValues = watch("nominees");

  const selectedProjectType = useMemo(
    () => projectTypes.find((item) => item.id === selectedProjectTypeId),
    [projectTypes, selectedProjectTypeId],
  );
  const referrerOptions = useMemo(
    () =>
      (referrerMembers ?? []).map((member) => ({
        value: member.id,
        label: `${member.user.name} - ${member.role.name} (${member.user.phone})`,
      })),
    [referrerMembers],
  );

  const selectedProjectTypeMinimumMonthly = useMemo(
    () => Number(selectedProjectType?.minimumMonthlyAmount ?? 0),
    [selectedProjectType],
  );

  const maturityAmountPreview = useMemo(() => {
    if (!selectedProjectType || !monthlyAmount || monthlyAmount <= 0) return null;
    const duration = selectedProjectType.duration;
    const maturityPerHundred = Number(selectedProjectType.maturityPerHundred ?? 0);
    const totalPrincipal = monthlyAmount * duration;
    const maturityInterest = (totalPrincipal * maturityPerHundred) / 100;
    return totalPrincipal + maturityInterest;
  }, [monthlyAmount, selectedProjectType]);

  const maturityDatePreview = useMemo(() => {
    if (!selectedProjectType) return null;
    return getMaturityDate(startDate, selectedProjectType.duration);
  }, [selectedProjectType, startDate]);

  const totalPrincipalPreview = useMemo(() => {
    if (!selectedProjectType || !monthlyAmount || monthlyAmount <= 0) return null;
    return monthlyAmount * selectedProjectType.duration;
  }, [monthlyAmount, selectedProjectType]);

  const maturityGainPreview = useMemo(() => {
    if (maturityAmountPreview === null || totalPrincipalPreview === null) return null;
    return maturityAmountPreview - totalPrincipalPreview;
  }, [maturityAmountPreview, totalPrincipalPreview]);

  useEffect(() => {
    if (!selectedProjectType) return;
    if (monthlyAmount < selectedProjectTypeMinimumMonthly) {
      setError("rd.monthlyAmount", {
        type: "manual",
        message: `Monthly amount must be greater than or equal to minimum (${selectedProjectTypeMinimumMonthly.toFixed(2)})`,
      });
      return;
    }
    if (errors.rd?.monthlyAmount?.type === "manual") {
      clearErrors("rd.monthlyAmount");
    }
  }, [
    clearErrors,
    errors.rd?.monthlyAmount?.type,
    monthlyAmount,
    selectedProjectType,
    selectedProjectTypeMinimumMonthly,
    setError,
  ]);

  const onSubmit = async (values: FormData) => {
    try {
      const projectType = projectTypes.find((item) => item.id === values.rd.projectTypeId);
      if (projectType && values.rd.monthlyAmount < Number(projectType.minimumMonthlyAmount ?? 0)) {
        setError("rd.monthlyAmount", {
          type: "manual",
          message: `Monthly amount must be greater than or equal to minimum (${Number(projectType.minimumMonthlyAmount ?? 0).toFixed(2)})`,
        });
        return;
      }

      const totalPrincipal =
        projectType && values.rd.monthlyAmount > 0
          ? values.rd.monthlyAmount * projectType.duration
          : 0;
      if (totalPrincipal > 0 && values.rd.initialPaymentAmount > totalPrincipal) {
        toast.error("Initial payment cannot be greater than total principal");
        return;
      }

      await mutation.mutateAsync({
        referrerMembershipId: values.referrerMembershipId,
        customer: {
          ...values.customer,
          email: values.customer.email || undefined,
        },
        nominees: values.nominees.map((nominee) => {
          const { customRelation, ...rest } = nominee;
          return {
            ...rest,
            relation:
              nominee.relation === "OTHER" ? (customRelation?.trim() ?? "") : nominee.relation,
          };
        }),
        rd: {
          projectTypeId: values.rd.projectTypeId,
          monthlyAmount: values.rd.monthlyAmount,
          startDate: new Date(values.rd.startDate).toISOString(),
        },
        payment:
          values.rd.initialPaymentAmount > 0
            ? {
                amount: values.rd.initialPaymentAmount,
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

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    setDocuments((prev) => [
      ...prev,
      ...selected.map((file) => ({ file, displayName: file.name })),
    ]);
    event.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>Create RD Account</DialogTitle>
          <DialogDescription>
            Customer, nominee, recurring deposit account, and initial transaction will be created
            together.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel>Referrer Member</RequiredLabel>
            <SearchableSingleSelectAsync
              value={watch("referrerMembershipId") || ""}
              onChange={(value) => setValue("referrerMembershipId", value, { shouldValidate: true })}
              options={referrerOptions}
              placeholder="Select referrer member"
              className="w-full"
            />
            {errors.referrerMembershipId ? (
              <p className="text-sm text-destructive">{errors.referrerMembershipId.message}</p>
            ) : null}
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
                {errors.customer?.email ? (
                  <p className="text-sm text-destructive">{errors.customer.email.message}</p>
                ) : null}
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
                      <p className="text-sm text-destructive">
                        {errors.nominees[index]?.name?.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <RequiredLabel>Phone</RequiredLabel>
                    <Input {...register(`nominees.${index}.phone`)} />
                    {errors.nominees?.[index]?.phone ? (
                      <p className="text-sm text-destructive">
                        {errors.nominees[index]?.phone?.message}
                      </p>
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
                      {errors.nominees?.[index]?.customRelation ? (
                        <p className="text-sm text-destructive">
                          {errors.nominees[index]?.customRelation?.message}
                        </p>
                      ) : null}
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
                      <p className="text-sm text-destructive">
                        {errors.nominees[index]?.aadhaar?.message}
                      </p>
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
                      <p className="text-sm text-destructive">
                        {errors.nominees[index]?.pan?.message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  name: "",
                  phone: "",
                  relation: "",
                  customRelation: "",
                  address: "",
                  aadhaar: "",
                  pan: "",
                })
              }
            >
              Add Nominee
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">RD Details</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <RequiredLabel>Project Type</RequiredLabel>
                <Select
                  value={selectedProjectTypeId}
                  onValueChange={(value) =>
                    setValue("rd.projectTypeId", value, { shouldValidate: true })
                  }
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
                {errors.rd?.projectTypeId ? (
                  <p className="text-sm text-destructive">{errors.rd.projectTypeId.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <RequiredLabel>Monthly Amount</RequiredLabel>
                <Input
                  type="number"
                  placeholder="Enter monthly amount"
                  {...register("rd.monthlyAmount", { valueAsNumber: true })}
                />
                {errors.rd?.monthlyAmount ? (
                  <p className="text-sm text-destructive">{errors.rd.monthlyAmount.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <RequiredLabel>Initial Payment Amount</RequiredLabel>
                <Input
                  type="number"
                  placeholder="Enter initial payment"
                  {...register("rd.initialPaymentAmount", { valueAsNumber: true })}
                />
                {errors.rd?.initialPaymentAmount ? (
                  <p className="text-sm text-destructive">
                    {errors.rd.initialPaymentAmount.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <RequiredLabel>Start Date</RequiredLabel>
                <Input type="date" placeholder="Select start date" {...register("rd.startDate")} />
                {errors.rd?.startDate ? (
                  <p className="text-sm text-destructive">{errors.rd.startDate.message}</p>
                ) : null}
              </div>
            </div>
            {selectedProjectType &&
            typeof monthlyAmount === "number" &&
            !Number.isNaN(monthlyAmount) &&
            monthlyAmount > 0 &&
            monthlyAmount < selectedProjectTypeMinimumMonthly ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Monthly amount is below this plan&apos;s minimum of Rs.{" "}
                {selectedProjectTypeMinimumMonthly.toFixed(2)}.
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Payment Info</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>Payment Method</RequiredLabel>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setValue("payment.paymentMethod", value as PaymentMethod, {
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
                  {errors.payment?.transactionId ? (
                    <p className="text-sm text-destructive">
                      {errors.payment.transactionId.message}
                    </p>
                  ) : null}
                </div>
              )}

              {paymentMethod === "UPI" && (
                <div className="space-y-2">
                  <Label>UPI ID</Label>
                  <Input {...register("payment.upiId")} />
                  {errors.payment?.upiId ? (
                    <p className="text-sm text-destructive">{errors.payment.upiId.message}</p>
                  ) : null}
                </div>
              )}

              {paymentMethod === "CHEQUE" && (
                <>
                  <div className="space-y-2">
                    <Label>Cheque Number</Label>
                    <Input {...register("payment.chequeNumber")} />
                    {errors.payment?.chequeNumber ? (
                      <p className="text-sm text-destructive">
                        {errors.payment.chequeNumber.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input {...register("payment.bankName")} />
                    {errors.payment?.bankName ? (
                      <p className="text-sm text-destructive">{errors.payment.bankName.message}</p>
                    ) : null}
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
                  <div
                    key={`${document.file.name}-${index}`}
                    className="rounded-md border p-2 space-y-2"
                  >
                    <p className="text-xs text-muted-foreground">Original: {document.file.name}</p>
                    <div className="flex gap-2">
                      <Input
                        value={document.displayName}
                        onChange={(event) =>
                          setDocuments((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, displayName: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setDocuments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                        }
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
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected Project Type
              </p>
              <div className="rounded-md border bg-background px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium text-right">
                    {selectedProjectType?.name ?? "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium text-right">
                    {selectedProjectType ? `${selectedProjectType.duration} months` : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Minimum Amount</span>
                  <span className="font-medium text-right">
                    {selectedProjectType
                      ? `Rs. ${selectedProjectTypeMinimumMonthly.toFixed(2)}`
                      : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Maturity basis</span>
                  <span className="font-medium text-right">
                    {selectedProjectType
                      ? `${Number(selectedProjectType.maturityPerHundred ?? 0).toFixed(2)} per Rs.100`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Calculation Preview
              </p>
              <div className="rounded-md border bg-background px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Deposit Amount</span>
                  <span className="font-medium text-right">
                    {totalPrincipalPreview !== null
                      ? `Rs. ${totalPrincipalPreview.toFixed(2)}`
                      : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Initial Paid</span>
                  <span className="font-medium text-right">
                    {initialPaymentAmount
                      ? `Rs. ${Number(initialPaymentAmount).toFixed(2)}`
                      : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Pending Amount</span>
                  <span className="font-medium text-right">
                    {totalPrincipalPreview !== null && initialPaymentAmount
                      ? `Rs. ${(totalPrincipalPreview - Number(initialPaymentAmount)).toFixed(2)}`
                      : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Maturity Amount</span>
                  <span className="font-semibold text-right">
                    {maturityAmountPreview !== null
                      ? `Rs. ${maturityAmountPreview.toFixed(2)}`
                      : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Estimated Gain</span>
                  <span className="font-semibold text-right text-emerald-700">
                    {maturityGainPreview !== null ? `Rs. ${maturityGainPreview.toFixed(2)}` : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <span className="text-muted-foreground">Maturity Date</span>
                  <span className="font-medium text-right">
                    {maturityDatePreview ? formatDate(maturityDatePreview) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || projectTypes.length === 0}>
              Create RD Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

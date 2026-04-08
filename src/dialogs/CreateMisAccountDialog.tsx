import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
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
  completeMisDocumentUpload,
  type MisDetail,
  type MisProjectType,
} from "@/lib/misApi";
import {
  useCreateMisAccountMutation,
  useMisReferrerMembersQuery,
  useUpdateMisAccountMutation,
} from "@/hooks/useMisApi";
import { toast } from "sonner";
import { getApiErrorMessage, getApiValidationErrors } from "@/lib/apiError";
import { formatDate } from "@/lib/dateFormat";

const schema = z
  .object({
    referrerMembershipId: z.string().optional(),
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
    if (
      payload.payment.amount !== undefined &&
      payload.payment.amount > payload.mis.depositAmount
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["payment", "amount"],
        message: "Initial payment cannot exceed deposit amount",
      });
    }
    if (payload.payment.paymentMethod === "UPI") {
      if (!payload.payment.upiId) {
        ctx.addIssue({
          code: "custom",
          path: ["payment", "upiId"],
          message: "UPI ID is required for UPI payments",
        });
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
        ctx.addIssue({
          code: "custom",
          path: ["payment", "bankName"],
          message: "Bank name is required for cheque payments",
        });
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
  mode?: "create" | "edit";
  initialData?: MisDetail | null;
  onSaved?: () => void;
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
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const SUPPORTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";
const isSupportedFileType = (fileName: string) => /\.(pdf|jpe?g|png|webp|docx?|xlsx?)$/i.test(fileName);

export const CreateMisAccountDialog = ({
  open,
  onOpenChange,
  societyId,
  projectTypes,
  mode = "create",
  initialData = null,
  onSaved,
}: CreateMisAccountDialogProps) => {
  const mutation = useCreateMisAccountMutation(societyId);
  const updateMutation = useUpdateMisAccountMutation(societyId, initialData?.id ?? "");
  const { data: referrerMembers } = useMisReferrerMembersQuery(societyId);
  const [documents, setDocuments] = useState<Array<{ file: File; displayName: string }>>([]);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const {
    register,
    control,
    setValue,
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
      mis: {
        projectTypeId: "",
        depositAmount: undefined as unknown as number,
        startDate: "",
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

    if (mode === "edit" && initialData) {
      reset({
        referrerMembershipId: "",
        customer: {
          fullName: initialData.customer.fullName ?? "",
          phone: initialData.customer.phone ?? "",
          email: initialData.customer.email ?? "",
          address: initialData.customer.address ?? "",
          aadhaar: initialData.customer.aadhaar ?? "",
          pan: initialData.customer.pan ?? "",
        },
        nominees:
          initialData.customer.nominees.map((nominee) => ({
            name: nominee.name ?? "",
            phone: nominee.phone ?? "",
            relation: nominee.relation ?? "",
            customRelation: "",
            address: nominee.address ?? "",
            aadhaar: nominee.aadhaar ?? "",
            pan: nominee.pan ?? "",
          })) ?? [],
        mis: {
          projectTypeId: initialData.projectType.id,
          depositAmount: Number(initialData.depositAmount),
          startDate: initialData.startDate.slice(0, 10),
        },
        payment: {
          amount: 0,
          paymentMethod: "CASH",
          transactionId: "",
          upiId: "",
          bankName: "",
          chequeNumber: "",
        },
      });
    }
  }, [initialData, mode, open, reset]);

  const selectedProjectTypeId = useWatch({ control, name: "mis.projectTypeId" });
  const depositAmount = useWatch({ control, name: "mis.depositAmount" }) ?? 0;
  const startDate = useWatch({ control, name: "mis.startDate" });
  const initialPaymentAmount = useWatch({ control, name: "payment.amount" }) ?? 0;
  const paymentMethod = useWatch({ control, name: "payment.paymentMethod" });
  const nomineeValues = useWatch({ control, name: "nominees" });
  const referrerMembershipId = useWatch({ control, name: "referrerMembershipId" });

  const selectedProjectType = useMemo(
    () => projectTypes.find((projectType) => projectType.id === selectedProjectTypeId),
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
    if (mode === "create" && !values.referrerMembershipId?.trim()) {
      setError("referrerMembershipId", {
        type: "manual",
        message: "Referrer member is required",
      });
      return;
    }
    if (selectedProjectType && values.mis.depositAmount < selectedProjectTypeMinimumAmount) {
      setError("mis.depositAmount", {
        type: "manual",
        message: `Deposit amount must be greater than or equal to minimum amount (${selectedProjectTypeMinimumAmount.toFixed(2)})`,
      });
      return;
    }

    try {
      if (mode === "edit" && initialData) {
        await updateMutation.mutateAsync({
          customer: {
            ...values.customer,
            email: values.customer.email || undefined,
            address: values.customer.address || undefined,
            aadhaar: values.customer.aadhaar || undefined,
            pan: values.customer.pan || undefined,
          },
          nominees: values.nominees.map((nominee) => {
            const { customRelation, ...rest } = nominee;
            return {
              ...rest,
              relation:
                nominee.relation === "OTHER" ? (customRelation?.trim() ?? "") : nominee.relation,
              address: nominee.address || undefined,
              aadhaar: nominee.aadhaar || undefined,
              pan: nominee.pan || undefined,
            };
          }),
        });
        toast.success("MIS account updated");
        onSaved?.();
        onOpenChange(false);
        return;
      }

      const referrerMembershipId = values.referrerMembershipId?.trim();
      if (!referrerMembershipId) {
        setError("referrerMembershipId", {
          type: "manual",
          message: "Referrer member is required",
        });
        return;
      }

      const created = await mutation.mutateAsync({
        referrerMembershipId: referrerMembershipId,
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
        setIsUploadingDocuments(true);
        try {
          await Promise.all(
            created.uploadTargets.map(async (target) => {
              const source = documents.find(
                (item) =>
                  item.file.name === target.fileName && item.displayName === target.displayName,
              );
              if (!source) return;

              const uploadResponse = await fetch(target.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": source.file.type || "application/octet-stream" },
                body: source.file,
              });
              if (!uploadResponse.ok) {
                throw new Error(`Failed to upload ${source.file.name} (status ${uploadResponse.status})`);
              }
              await completeMisDocumentUpload(societyId, created.id, target.documentId);
            }),
          );
        } finally {
          setIsUploadingDocuments(false);
        }
      }

      toast.success("MIS account created");
      reset();
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      const validationErrors = getApiValidationErrors(error);
      Object.entries(validationErrors).forEach(([field, message]) => {
        setError(field as keyof FormData, { type: "server", message });
      });
      toast.error(getApiErrorMessage(error, "Failed to create MIS account"));
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const accepted = selected.filter((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`${file.name} exceeds 100MB limit`);
        return false;
      }
      if (!isSupportedFileType(file.name)) {
        toast.error(`${file.name} is not a supported file type`);
        return false;
      }
      return true;
    });
    if (!accepted.length) {
      event.target.value = "";
      return;
    }
    setDocuments((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, displayName: file.name })),
    ]);
    event.target.value = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDocuments([]);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit MIS Account" : "Create MIS Account"}</DialogTitle>
          <DialogDescription>
            Customer, nominee, MIS account, and initial deposit transaction will be created
            together.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {mode === "create" ? (
            <div className="space-y-2">
            <RequiredLabel>Referrer Member</RequiredLabel>
            <SearchableSingleSelectAsync
              value={referrerMembershipId || ""}
              onChange={(value) =>
                setValue("referrerMembershipId", value, { shouldValidate: true })
              }
              options={referrerOptions}
              placeholder="Select referrer member"
              className="w-full"
            />
            {errors.referrerMembershipId ? (
              <p className="text-sm text-destructive">{errors.referrerMembershipId.message}</p>
            ) : null}
            </div>
          ) : null}

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
                    {errors.nominees?.[index]?.relation ? (
                      <p className="text-sm text-destructive">
                        {errors.nominees[index]?.relation?.message}
                      </p>
                    ) : null}
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

          {mode === "create" ? (
            <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">MIS Details</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <RequiredLabel>Project Type</RequiredLabel>
                <Select
                  value={selectedProjectTypeId}
                  onValueChange={(value) =>
                    setValue("mis.projectTypeId", value, { shouldValidate: true })
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
                {errors.mis?.projectTypeId ? (
                  <p className="text-sm text-destructive">{errors.mis.projectTypeId.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel>Deposit Amount</RequiredLabel>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter deposit amount"
                  {...register("mis.depositAmount", { valueAsNumber: true })}
                />
                {errors.mis?.depositAmount ? (
                  <p className="text-sm text-destructive">{errors.mis.depositAmount.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel>Start Date</RequiredLabel>
                <Input type="date" placeholder="Select start date" {...register("mis.startDate")} />
              </div>
            </div>
            {selectedProjectType &&
            typeof depositAmount === "number" &&
            !Number.isNaN(depositAmount) &&
            depositAmount > 0 &&
            depositAmount < selectedProjectTypeMinimumAmount ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Deposit amount is below this plan&apos;s minimum of Rs.{" "}
                {selectedProjectTypeMinimumAmount.toFixed(2)}.
              </div>
            ) : null}
            </div>
          ) : null}

          {mode === "create" ? (
            <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Payment Info</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>Initial Payment Amount</RequiredLabel>
                <Input
                  type="number"
                  step="0.01"
                  {...register("payment.amount", { valueAsNumber: true })}
                />
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
          ) : null}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Documents</h3>
            {mode === "edit" ? (
              initialData?.documents?.length ? (
                <div className="space-y-2">
                  {initialData.documents.map((document) => (
                    <div key={document.id} className="rounded-md border p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{document.displayName}</p>
                        <p className="text-xs text-muted-foreground">{document.fileName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="xs" asChild>
                          <a href={document.fileUrl} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </Button>
                        <Button type="button" size="xs" asChild>
                          <a href={document.fileUrl} download={document.fileName}>
                            Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              )
            ) : null}
            <Input type="file" multiple accept={SUPPORTED_FILE_TYPES} onChange={handleFilesSelected} />
            <p className="text-xs text-muted-foreground">
              Max file size: 100MB each. Supported: PDF, JPG, JPEG, PNG, WEBP, DOC, DOCX, XLS, XLSX.
            </p>
            {isUploadingDocuments ? (
              <p className="text-xs text-primary">Uploading documents... Please wait for large files.</p>
            ) : null}
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

          {mode === "create" ? (
            <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected Project Type
              </p>
              <div className="rounded-md border bg-background px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium sm:text-right">
                    {selectedProjectType?.name ?? "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium sm:text-right">
                    {selectedProjectType ? `${selectedProjectType.duration} months` : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Minimum Amount</span>
                  <span className="font-medium sm:text-right">
                    {formatCurrency(selectedProjectTypeMinimumAmount)}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Interest Config</span>
                  <span className="font-medium sm:text-right">{interestTypePreview}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Calculation Preview
              </p>
              <div className="rounded-md border bg-background px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Monthly Interest</span>
                  <span className="font-semibold sm:text-right">
                    {formatCurrency(monthlyInterestPreview)}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Maturity Date</span>
                  <span className="font-medium sm:text-right">
                    {maturityDatePreview ? formatDate(maturityDatePreview) : "N/A"}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Total Interest</span>
                  <span className="font-medium sm:text-right">
                    {formatCurrency(totalInterestPreview)}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Principal Return</span>
                  <span className="font-medium sm:text-right">
                    {formatCurrency(Number(depositAmount || 0))}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Total Return</span>
                  <span className="font-semibold text-emerald-700 sm:text-right">
                    {formatCurrency(totalReturnPreview)}
                  </span>
                </div>
                <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[160px_1fr] sm:gap-2">
                  <span className="text-muted-foreground">Remaining Deposit</span>
                  <span className="font-medium sm:text-right">
                    {formatCurrency(Math.max(0, depositAmount - initialPaymentAmount))}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Future Interest Schedule
              </p>
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
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                updateMutation.isPending ||
                isUploadingDocuments ||
                (mode === "create" && projectTypes.length === 0)
              }
            >
              {isUploadingDocuments ? "Uploading Documents..." : mode === "edit" ? "Save Changes" : "Create MIS Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

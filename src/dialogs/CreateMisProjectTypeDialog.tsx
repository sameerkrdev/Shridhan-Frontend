import { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateMisProjectTypeMutation } from "@/hooks/useMisApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EXAMPLE_DEPOSITS = [1_000, 10_000, 100_000] as const;
const PREVIEW_DURATION_FALLBACK = 12;

const formatRs = (value: number) =>
  `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPct = (value: number) =>
  `${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/**
 * When monthly payout is `m` rupees per ₹100 principal per month, monthly return on principal is (m/100).
 * Simple annual rate (%) = 12 × (m/100) × 100 = 12m.
 */
const equivalentAnnualSimplePercentFromMonthlyPerHundred = (monthlyPayoutPerHundred: number) =>
  12 * monthlyPayoutPerHundred;

const schema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    duration: z
      .number({ message: "Duration is required" })
      .int("Duration must be a whole number")
      .min(1, "Duration must be at least 1")
      .max(360, "Duration is too large"),
    minimumAmount: z
      .number({ message: "Minimum Principal amount is required" })
      .min(1, "Minimum Principal amount must be greater than 0")
      .max(100000000, "Minimum Principal amount is too large"),
    calculationMethod: z.enum(["MONTHLY_PAYOUT_PER_HUNDRED", "ANNUAL_INTEREST_RATE"]),
    monthlyPayoutAmountPerHundred: z
      .number({ message: "Monthly payout value is required" })
      .min(0, "Value cannot be negative")
      .max(1000000, "Value is too large")
      .optional(),
    annualInterestRate: z
      .number({ message: "Annual interest rate is required" })
      .min(0, "Value cannot be negative")
      .max(100, "Value cannot exceed 100")
      .optional(),
  })
  .superRefine((values, ctx) => {
    if (
      values.calculationMethod === "MONTHLY_PAYOUT_PER_HUNDRED" &&
      values.monthlyPayoutAmountPerHundred === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyPayoutAmountPerHundred"],
        message: "Monthly payout amount per hundred is required",
      });
    }

    if (
      values.calculationMethod === "ANNUAL_INTEREST_RATE" &&
      values.annualInterestRate === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["annualInterestRate"],
        message: "Annual interest rate is required",
      });
    }
  });

type FormData = z.infer<typeof schema>;

interface CreateMisProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
}

export const CreateMisProjectTypeDialog = ({
  open,
  onOpenChange,
  societyId,
}: CreateMisProjectTypeDialogProps) => {
  const mutation = useCreateMisProjectTypeMutation(societyId);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      duration: undefined,
      minimumAmount: undefined,
      calculationMethod: "MONTHLY_PAYOUT_PER_HUNDRED",
      monthlyPayoutAmountPerHundred: undefined,
      annualInterestRate: undefined,
    },
  });
  const calculationMethod = watch("calculationMethod");
  const duration = watch("duration");
  const minimumAmount = watch("minimumAmount");
  const monthlyPayoutAmountPerHundred = watch("monthlyPayoutAmountPerHundred");
  const annualInterestRate = watch("annualInterestRate");

  const examplePreview = useMemo(() => {
    const months =
      typeof duration === "number" && !Number.isNaN(duration) && duration >= 1
        ? duration
        : PREVIEW_DURATION_FALLBACK;

    const hasMonthlyConfig =
      calculationMethod === "MONTHLY_PAYOUT_PER_HUNDRED" &&
      typeof monthlyPayoutAmountPerHundred === "number" &&
      !Number.isNaN(monthlyPayoutAmountPerHundred);
    const hasAnnualConfig =
      calculationMethod === "ANNUAL_INTEREST_RATE" &&
      typeof annualInterestRate === "number" &&
      !Number.isNaN(annualInterestRate);

    if (!hasMonthlyConfig && !hasAnnualConfig) return null;

    const usedFallbackDuration = !(
      typeof duration === "number" &&
      !Number.isNaN(duration) &&
      duration >= 1
    );

    const depositAmounts: number[] = [];
    if (typeof minimumAmount === "number" && !Number.isNaN(minimumAmount) && minimumAmount >= 1) {
      depositAmounts.push(minimumAmount);
    }
    for (const d of EXAMPLE_DEPOSITS) {
      if (!depositAmounts.includes(d)) depositAmounts.push(d);
    }

    const rows = depositAmounts.map((deposit) => {
      let monthly: number;
      let interestRateLabel: string;

      if (calculationMethod === "MONTHLY_PAYOUT_PER_HUNDRED") {
        monthly = (deposit / 100) * monthlyPayoutAmountPerHundred!;
        interestRateLabel = formatPct(
          equivalentAnnualSimplePercentFromMonthlyPerHundred(monthlyPayoutAmountPerHundred!),
        );
      } else {
        monthly = (deposit * annualInterestRate!) / 100 / 12;
        interestRateLabel = formatPct(annualInterestRate!);
      }

      const totalInterest = monthly * months;
      const totalPayout = deposit + totalInterest;

      return {
        deposit,
        monthly,
        totalInterest,
        totalPayout,
        interestRateLabel,
      };
    });

    return { months, usedFallbackDuration, rows };
  }, [
    calculationMethod,
    duration,
    minimumAmount,
    monthlyPayoutAmountPerHundred,
    annualInterestRate,
  ]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync({
        name: values.name,
        duration: values.duration,
        minimumAmount: values.minimumAmount,
        calculationMethod: values.calculationMethod,
        monthlyPayoutAmountPerHundred:
          values.calculationMethod === "MONTHLY_PAYOUT_PER_HUNDRED"
            ? values.monthlyPayoutAmountPerHundred
            : undefined,
        annualInterestRate:
          values.calculationMethod === "ANNUAL_INTEREST_RATE"
            ? values.annualInterestRate
            : undefined,
      });
      toast.success("MIS project type created");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create MIS project type"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create MIS Project Type</DialogTitle>
          <DialogDescription>Define MIS monthly payout configuration.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel htmlFor="mis-project-name">Name</RequiredLabel>
            <Input
              id="mis-project-name"
              className="w-full"
              placeholder="MIS 36 Month"
              {...register("name")}
            />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
            <div className="space-y-2">
              <RequiredLabel htmlFor="mis-project-duration">Duration (months)</RequiredLabel>
              <Input
                id="mis-project-duration"
                className="w-full"
                type="number"
                placeholder="Enter duration"
                {...register("duration", { valueAsNumber: true })}
              />
              {errors.duration ? (
                <p className="text-sm text-destructive">{errors.duration.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="mis-project-minimum">Minimum Principal Amount</RequiredLabel>
              <Input
                id="mis-project-minimum"
                className="w-full"
                type="number"
                step="0.01"
                placeholder="Enter minimum principal amount"
                {...register("minimumAmount", { valueAsNumber: true })}
              />
              {errors.minimumAmount ? (
                <p className="text-sm text-destructive">{errors.minimumAmount.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
            <div className="flex flex-col gap-2">
              <div className=" flex items-end">
                <RequiredLabel htmlFor="mis-calculation-method" className="leading-snug">
                  Calculation Method
                </RequiredLabel>
              </div>
              <Select
                value={calculationMethod}
                onValueChange={(value) => {
                  setValue("calculationMethod", value as FormData["calculationMethod"], {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  if (value === "MONTHLY_PAYOUT_PER_HUNDRED") {
                    setValue("annualInterestRate", undefined, {
                      shouldDirty: true,
                      shouldValidate: false,
                    });
                  } else {
                    setValue("monthlyPayoutAmountPerHundred", undefined, {
                      shouldDirty: true,
                      shouldValidate: false,
                    });
                  }
                }}
              >
                <SelectTrigger id="mis-calculation-method" className="w-full">
                  <SelectValue placeholder="Select calculation method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY_PAYOUT_PER_HUNDRED">
                    Monthly Payout Calculation
                  </SelectItem>
                  <SelectItem value="ANNUAL_INTEREST_RATE">Interest Rate Calculation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              {calculationMethod === "MONTHLY_PAYOUT_PER_HUNDRED" ? (
                <>
                  <div className="flex items-end">
                    <RequiredLabel htmlFor="mis-payout-per-hundred" className="leading-snug">
                      Monthly payout (per ₹100 principal)
                    </RequiredLabel>
                  </div>
                  <Input
                    id="mis-payout-per-hundred"
                    className="w-full"
                    type="number"
                    step="0.01"
                    placeholder="Enter monthly amount per hundred"
                    {...register("monthlyPayoutAmountPerHundred", {
                      setValueAs: (value) => (value === "" ? undefined : Number(value)),
                    })}
                  />
                  {errors.monthlyPayoutAmountPerHundred ? (
                    <p className="text-sm text-destructive">
                      {errors.monthlyPayoutAmountPerHundred.message}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex items-end">
                    <RequiredLabel htmlFor="mis-annual-interest-rate" className="leading-snug">
                      Annual interest rate (%)
                    </RequiredLabel>
                  </div>
                  <Input
                    id="mis-annual-interest-rate"
                    className="w-full"
                    type="number"
                    step="0.01"
                    placeholder="Enter annual interest rate"
                    {...register("annualInterestRate", {
                      setValueAs: (value) => (value === "" ? undefined : Number(value)),
                    })}
                  />
                  {errors.annualInterestRate ? (
                    <p className="text-sm text-destructive">{errors.annualInterestRate.message}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {examplePreview ? (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Example accounts (preview)</p>
                <p className="text-xs text-muted-foreground">
                  Includes your minimum principal (if set) plus sample amounts. Total interest is
                  monthly payout × duration; total payout is deposit + total interest.
                  {examplePreview.usedFallbackDuration ? (
                    <>
                      {" "}
                      Duration not set: using {PREVIEW_DURATION_FALLBACK} months for this preview.
                    </>
                  ) : null}
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Example deposit</TableHead>
                    <TableHead className="whitespace-nowrap">Monthly payout</TableHead>
                    <TableHead className="whitespace-nowrap">Duration</TableHead>
                    <TableHead className="whitespace-nowrap">Total interest</TableHead>
                    <TableHead className="whitespace-nowrap">Total payout</TableHead>
                    <TableHead className="whitespace-nowrap">Equiv. annual (simple %)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examplePreview.rows.map((row) => (
                    <TableRow key={row.deposit}>
                      <TableCell className="font-medium">{formatRs(row.deposit)}</TableCell>
                      <TableCell>{formatRs(row.monthly)}</TableCell>
                      <TableCell>{examplePreview.months} mo</TableCell>
                      <TableCell>{formatRs(row.totalInterest)}</TableCell>
                      <TableCell>{formatRs(row.totalPayout)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.interestRateLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enter payout per hundred or annual rate to see example deposits, monthly payout, and
              totals.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { Fragment, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
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
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateRdProjectTypeMutation } from "@/hooks/useRdApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  Dialog as HelpDialog,
  DialogContent as HelpDialogContent,
  DialogDescription as HelpDialogDescription,
  DialogHeader as HelpDialogHeader,
  DialogTitle as HelpDialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PREVIEW_DURATION_FALLBACK = 12;
/** Used for fine scenarios when minimum monthly amount is not set yet */
const PREVIEW_MONTHLY_INSTALLMENT_FALLBACK = 5_000;

const formatRs = (value: number) =>
  `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Matches `rdDueCalculator`: fine = baseFine × missedMonths; if missedMonths ≥ penaltyStartMonth, × multiplier */
const computeOverdueFine = (
  baseFine: number,
  missedMonths: number,
  penaltyStartMonth: number,
  penaltyMultiplier: number,
): number => {
  if (missedMonths <= 0) return 0;
  let fine = baseFine * missedMonths;
  if (missedMonths >= penaltyStartMonth) {
    fine *= penaltyMultiplier;
  }
  return fine;
};

const numberFromInput = (v: unknown): number | undefined => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? undefined : n;
};

const schema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    duration: z
      .number({ message: "Duration is required" })
      .int("Duration must be a whole number")
      .min(1)
      .max(360),
    minimumMonthlyAmount: z
      .number()
      .min(1, "Minimum monthly amount must be greater than 0")
      .max(100000000),
    maturityPerHundred: z.number().min(0, "Maturity per hundred cannot be negative").max(1000000),
    fineCalculationMethod: z.enum(["FIXED_PER_STREAK_UNIT", "PROPORTIONAL_PER_HUNDRED"]),
    fixedOverdueFineAmount: z.number().min(0).max(100000000).optional(),
    fineRatePerHundred: z.number().min(0).max(1000000).optional(),
    graceDays: z.number().int().min(0).max(365),
    penaltyMultiplier: z.number().min(0).max(1000).optional(),
    penaltyStartMonth: z.number().int().min(1).max(360).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fineCalculationMethod === "FIXED_PER_STREAK_UNIT") {
      const v = data.fixedOverdueFineAmount;
      if (typeof v !== "number" || Number.isNaN(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed overdue fine amount is required",
          path: ["fixedOverdueFineAmount"],
        });
      }
    } else {
      const v = data.fineRatePerHundred;
      if (typeof v !== "number" || Number.isNaN(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fine rate per ₹100 is required",
          path: ["fineRatePerHundred"],
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

interface CreateRdProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
}

export const CreateRdProjectTypeDialog = ({
  open,
  onOpenChange,
  societyId,
}: CreateRdProjectTypeDialogProps) => {
  const [helpOpen, setHelpOpen] = useState(false);
  const mutation = useCreateRdProjectTypeMutation(societyId);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      duration: undefined,
      minimumMonthlyAmount: undefined,
      maturityPerHundred: undefined,
      fineCalculationMethod: "FIXED_PER_STREAK_UNIT",
      fixedOverdueFineAmount: undefined,
      fineRatePerHundred: undefined,
      graceDays: undefined,
      penaltyMultiplier: undefined,
      penaltyStartMonth: undefined,
    },
  });

  const [
    duration,
    maturityPerHundred,
    fineCalculationMethod,
    fixedOverdueFineAmount,
    fineRatePerHundred,
    minimumMonthlyAmount,
    graceDays,
    penaltyMultiplier,
    penaltyStartMonth,
  ] = useWatch({
    control,
    name: [
      "duration",
      "maturityPerHundred",
      "fineCalculationMethod",
      "fixedOverdueFineAmount",
      "fineRatePerHundred",
      "minimumMonthlyAmount",
      "graceDays",
      "penaltyMultiplier",
      "penaltyStartMonth",
    ],
  });

  const maturityPreview = useMemo(() => {
    if (typeof maturityPerHundred !== "number" || Number.isNaN(maturityPerHundred)) {
      return null;
    }
    if (
      typeof minimumMonthlyAmount !== "number" ||
      Number.isNaN(minimumMonthlyAmount) ||
      minimumMonthlyAmount < 1
    ) {
      return null;
    }

    const months =
      typeof duration === "number" && !Number.isNaN(duration) && duration >= 1
        ? duration
        : PREVIEW_DURATION_FALLBACK;

    const usedFallbackDuration = !(
      typeof duration === "number" &&
      !Number.isNaN(duration) &&
      duration >= 1
    );

    const monthly = minimumMonthlyAmount;
    const totalPrincipal = monthly * months;
    const maturityInterest = (totalPrincipal * maturityPerHundred) / 100;
    const maturityPayout = totalPrincipal + maturityInterest;

    return {
      months,
      usedFallbackDuration,
      monthly,
      totalPrincipal,
      maturityInterest,
      maturityPayout,
    };
  }, [duration, maturityPerHundred, minimumMonthlyAmount]);

  const feePreview = useMemo(() => {
    const monthlyForFee =
      typeof minimumMonthlyAmount === "number" &&
      !Number.isNaN(minimumMonthlyAmount) &&
      minimumMonthlyAmount >= 1
        ? minimumMonthlyAmount
        : PREVIEW_MONTHLY_INSTALLMENT_FALLBACK;

    const usedFallbackMonthly = !(
      typeof minimumMonthlyAmount === "number" &&
      !Number.isNaN(minimumMonthlyAmount) &&
      minimumMonthlyAmount >= 1
    );

    const penaltyMult =
      typeof penaltyMultiplier === "number" && !Number.isNaN(penaltyMultiplier)
        ? penaltyMultiplier
        : 1;
    const penaltyStart =
      typeof penaltyStartMonth === "number" && !Number.isNaN(penaltyStartMonth)
        ? penaltyStartMonth
        : 1;

    let baseFine: number;
    if (fineCalculationMethod === "FIXED_PER_STREAK_UNIT") {
      if (typeof fixedOverdueFineAmount !== "number" || Number.isNaN(fixedOverdueFineAmount)) {
        return null;
      }
      baseFine = fixedOverdueFineAmount;
    } else {
      if (typeof fineRatePerHundred !== "number" || Number.isNaN(fineRatePerHundred)) {
        return null;
      }
      baseFine = (monthlyForFee / 100) * fineRatePerHundred;
    }

    const feeSections: Array<{
      key: string;
      title: string;
      rows: Array<{
        situation: string;
        missedLabel: string;
        fine: number;
        totalDue: number;
      }>;
    }> = [
      {
        key: "ontime",
        title: "On time",
        rows: [
          {
            situation: "Paid within grace (no overdue fine on this line)",
            missedLabel: "—",
            fine: 0,
            totalDue: monthlyForFee,
          },
        ],
      },
      {
        key: "single",
        title: "One overdue month",
        rows: [
          {
            situation: "Single month overdue (only one in the run)",
            missedLabel: "1",
            fine: computeOverdueFine(baseFine, 1, penaltyStart, penaltyMult),
            totalDue: monthlyForFee + computeOverdueFine(baseFine, 1, penaltyStart, penaltyMult),
          },
        ],
      },
      {
        key: "run2",
        title: "Two consecutive overdue months",
        rows: [
          {
            situation: "Older installment in the run (higher missed-month count)",
            missedLabel: "2",
            fine: computeOverdueFine(baseFine, 2, penaltyStart, penaltyMult),
            totalDue: monthlyForFee + computeOverdueFine(baseFine, 2, penaltyStart, penaltyMult),
          },
          {
            situation: "Newer installment in the run",
            missedLabel: "1",
            fine: computeOverdueFine(baseFine, 1, penaltyStart, penaltyMult),
            totalDue: monthlyForFee + computeOverdueFine(baseFine, 1, penaltyStart, penaltyMult),
          },
        ],
      },
      {
        key: "run3",
        title: "Three consecutive overdue months",
        rows: [
          {
            situation: "Oldest installment in the run",
            missedLabel: "3",
            fine: computeOverdueFine(baseFine, 3, penaltyStart, penaltyMult),
            totalDue: monthlyForFee + computeOverdueFine(baseFine, 3, penaltyStart, penaltyMult),
          },
          {
            situation: "Middle installment",
            missedLabel: "2",
            fine: computeOverdueFine(baseFine, 2, penaltyStart, penaltyMult),
            totalDue: monthlyForFee + computeOverdueFine(baseFine, 2, penaltyStart, penaltyMult),
          },
          {
            situation: "Newest installment in the run",
            missedLabel: "1",
            fine: computeOverdueFine(baseFine, 1, penaltyStart, penaltyMult),
            totalDue: monthlyForFee + computeOverdueFine(baseFine, 1, penaltyStart, penaltyMult),
          },
        ],
      },
    ];

    const graceDaysDisplay =
      typeof graceDays === "number" && !Number.isNaN(graceDays) ? graceDays : null;

    return {
      mode: fineCalculationMethod,
      monthlyForFee,
      usedFallbackMonthly,
      baseFine,
      fineRatePerHundred:
        fineCalculationMethod === "PROPORTIONAL_PER_HUNDRED" ? fineRatePerHundred : null,
      fixedOverdueFineAmount:
        fineCalculationMethod === "FIXED_PER_STREAK_UNIT" ? fixedOverdueFineAmount : null,
      penaltyMult,
      penaltyStart,
      graceDaysDisplay,
      feeSections,
    };
  }, [
    fineCalculationMethod,
    fixedOverdueFineAmount,
    fineRatePerHundred,
    minimumMonthlyAmount,
    graceDays,
    penaltyMultiplier,
    penaltyStartMonth,
  ]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync({
        name: values.name,
        duration: values.duration,
        minimumMonthlyAmount: values.minimumMonthlyAmount,
        maturityPerHundred: values.maturityPerHundred,
        fineCalculationMethod: values.fineCalculationMethod,
        ...(values.fineCalculationMethod === "FIXED_PER_STREAK_UNIT"
          ? { fixedOverdueFineAmount: values.fixedOverdueFineAmount! }
          : { fineRatePerHundred: values.fineRatePerHundred! }),
        graceDays: values.graceDays,
        penaltyMultiplier: values.penaltyMultiplier,
        penaltyStartMonth: values.penaltyStartMonth,
      });
      toast.success("RD project type created");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create RD project type"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create RD Project Type</DialogTitle>
          <DialogDescription>
            Monthly installment, fine, and maturity interest configuration.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel htmlFor="rd-pt-name">Name</RequiredLabel>
            <Input id="rd-pt-name" placeholder="RD 24 Month" {...register("name")} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-duration">Duration (months)</RequiredLabel>
              <Input
                id="rd-pt-duration"
                type="number"
                placeholder="e.g. 12"
                {...register("duration", { valueAsNumber: true })}
              />
              {errors.duration ? (
                <p className="text-sm text-destructive">{errors.duration.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-min">Minimum monthly amount</RequiredLabel>
              <Input
                id="rd-pt-min"
                type="number"
                step="0.01"
                placeholder="e.g. 1000"
                {...register("minimumMonthlyAmount", { valueAsNumber: true })}
              />
              {errors.minimumMonthlyAmount ? (
                <p className="text-sm text-destructive">{errors.minimumMonthlyAmount.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-maturity-per-hundred">
                Maturity per hundred
              </RequiredLabel>
              <Input
                id="rd-pt-maturity-per-hundred"
                type="number"
                step="0.01"
                placeholder="e.g. 5"
                {...register("maturityPerHundred", { valueAsNumber: true })}
              />
              {errors.maturityPerHundred ? (
                <p className="text-sm text-destructive">{errors.maturityPerHundred.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-fine-method">Overdue fine calculation</RequiredLabel>
              <select
                id="rd-pt-fine-method"
                className={cn(
                  "border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  "dark:bg-input/30",
                )}
                {...register("fineCalculationMethod")}
              >
                <option value="FIXED_PER_STREAK_UNIT">Fixed amount per missed-month step</option>
                <option value="PROPORTIONAL_PER_HUNDRED">
                  Proportional per ₹100 of monthly installment
                </option>
              </select>
              <p className="text-xs text-muted-foreground">
                Within each consecutive overdue run, the oldest unpaid installment gets the highest
                missed-month multiplier (N), then N−1, … down to 1 for the newest in that run.
              </p>
            </div>
            {fineCalculationMethod === "FIXED_PER_STREAK_UNIT" ? (
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel htmlFor="rd-pt-fixed-fine">
                  Fixed overdue fine (per missed-month unit)
                </RequiredLabel>
                <Input
                  id="rd-pt-fixed-fine"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 20"
                  {...register("fixedOverdueFineAmount", { setValueAs: numberFromInput })}
                />
                {errors.fixedOverdueFineAmount ? (
                  <p className="text-sm text-destructive">
                    {errors.fixedOverdueFineAmount.message}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Does not scale with monthly amount. Total overdue fine = this amount × missed
                    months for that installment (then penalty rules below, if any).
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel htmlFor="rd-pt-fine-rate">
                  Fine rate (per ₹100 of monthly amount)
                </RequiredLabel>
                <Input
                  id="rd-pt-fine-rate"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2"
                  {...register("fineRatePerHundred", { setValueAs: numberFromInput })}
                />
                {errors.fineRatePerHundred ? (
                  <p className="text-sm text-destructive">{errors.fineRatePerHundred.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Base fine per step = (monthly installment ÷ 100) × this rate, then × missed
                    months for that installment.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <RequiredLabel htmlFor="rd-pt-grace">Grace days</RequiredLabel>
              <Input
                id="rd-pt-grace"
                type="number"
                placeholder="e.g. 7"
                {...register("graceDays", { valueAsNumber: true })}
              />
              {errors.graceDays ? (
                <p className="text-sm text-destructive">{errors.graceDays.message}</p>
              ) : null}
            </div>
            <div className="hidden sm:block" />
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Advanced penalty settings (optional)
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel htmlFor="rd-pt-pen-mul">Penalty multiplier</RequiredLabel>
                <Input
                  id="rd-pt-pen-mul"
                  type="number"
                  step="0.01"
                  placeholder="Leave empty to use default 1"
                  {...register("penaltyMultiplier", {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                />
                {errors.penaltyMultiplier ? (
                  <p className="text-sm text-destructive">{errors.penaltyMultiplier.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel htmlFor="rd-pt-pen-start">Penalty from month (streak)</RequiredLabel>
                <Input
                  id="rd-pt-pen-start"
                  type="number"
                  placeholder="Leave empty to use default 1"
                  {...register("penaltyStartMonth", {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                />
                {errors.penaltyStartMonth ? (
                  <p className="text-sm text-destructive">{errors.penaltyStartMonth.message}</p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => setHelpOpen(true)}
            >
              Help: how penalty works
            </Button>
          </details>

          {maturityPreview || feePreview ? (
            <div className="space-y-4">
              {maturityPreview ? (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Maturity (preview)</p>
                    <p className="text-xs text-muted-foreground">
                      Uses your <strong>minimum monthly amount</strong> and{" "}
                      <strong>maturity per hundred</strong>. Assumes every month is paid on time for
                      the full duration. Maturity payout = total principal + interest (interest =
                      total principal × maturity per hundred ÷ 100).
                      {maturityPreview.usedFallbackDuration ? (
                        <>
                          {" "}
                          Duration not set: using {PREVIEW_DURATION_FALLBACK} months for this
                          preview.
                        </>
                      ) : null}
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Monthly installment</TableHead>
                        <TableHead className="whitespace-nowrap">Duration</TableHead>
                        <TableHead className="whitespace-nowrap">Total principal</TableHead>
                        <TableHead className="whitespace-nowrap">Maturity interest</TableHead>
                        <TableHead className="whitespace-nowrap">Maturity payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">
                          {formatRs(maturityPreview.monthly)}
                        </TableCell>
                        <TableCell>{maturityPreview.months} mo</TableCell>
                        <TableCell>{formatRs(maturityPreview.totalPrincipal)}</TableCell>
                        <TableCell>{formatRs(maturityPreview.maturityInterest)}</TableCell>
                        <TableCell>{formatRs(maturityPreview.maturityPayout)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {feePreview ? (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {feePreview.mode === "FIXED_PER_STREAK_UNIT"
                        ? "Fine / overdue (preview — fixed per step)"
                        : "Fine / overdue (preview — proportional)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {feePreview.mode === "FIXED_PER_STREAK_UNIT" ? (
                        <>
                          Fixed base fine {formatRs(feePreview.baseFine)} per missed-month unit
                          (does not depend on monthly amount).{" "}
                        </>
                      ) : (
                        <>
                          Fine rate {feePreview.fineRatePerHundred} per ₹100 of monthly; base fine
                          per step = (monthly ÷ 100) × rate = {formatRs(feePreview.baseFine)}.{" "}
                        </>
                      )}
                      Example monthly installment {formatRs(feePreview.monthlyForFee)}
                      {feePreview.usedFallbackMonthly
                        ? ` (minimum not set: using ${formatRs(PREVIEW_MONTHLY_INSTALLMENT_FALLBACK)})`
                        : " (from minimum monthly amount)"}
                      . Grace{" "}
                      {feePreview.graceDaysDisplay !== null
                        ? `${feePreview.graceDaysDisplay} day(s)`
                        : "not set (use form)"}
                      ; penalty from missed-month count {feePreview.penaltyStart}, multiplier{" "}
                      {feePreview.penaltyMult}. Within a consecutive overdue block, missed-month
                      counts run from N (oldest) down to 1 (newest). Overdue fine = base × missed
                      months; if missed months ≥ penalty start, multiply the whole fine by the
                      multiplier.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Situation</TableHead>
                        <TableHead className="whitespace-nowrap">Missed months</TableHead>
                        <TableHead className="whitespace-nowrap">Fine</TableHead>
                        <TableHead className="whitespace-nowrap">
                          Total due (principal + fine)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feePreview.feeSections.map((section, sectionIndex) => (
                        <Fragment key={section.key}>
                          {sectionIndex > 0 ? (
                            <TableRow className="border-0 hover:bg-transparent">
                              <TableCell
                                colSpan={4}
                                className="h-3 p-0 bg-transparent"
                                aria-hidden
                              />
                            </TableRow>
                          ) : null}
                          <TableRow className="bg-muted/50 hover:bg-muted/50 border-t border-border">
                            <TableCell
                              colSpan={4}
                              className="py-2.5 text-xs font-semibold text-foreground tracking-tight"
                            >
                              {section.title}
                            </TableCell>
                          </TableRow>
                          {section.rows.map((row) => (
                            <TableRow key={`${section.key}-${row.situation}`}>
                              <TableCell className="max-w-[240px] text-sm leading-snug">
                                {row.situation}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.missedLabel}
                              </TableCell>
                              <TableCell>{formatRs(row.fine)}</TableCell>
                              <TableCell>{formatRs(row.totalDue)}</TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enter maturity per hundred and minimum monthly amount for payout preview; choose
              overdue fee mode and enter fixed amount or fine rate (and optional grace / penalty)
              for overdue fine scenarios.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen}>
        <HelpDialogContent className="sm:max-w-[560px]">
          <HelpDialogHeader>
            <HelpDialogTitle>Penalty settings explained</HelpDialogTitle>
            <HelpDialogDescription>
              These settings affect overdue fine escalation after grace period.
            </HelpDialogDescription>
          </HelpDialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Fixed mode:</strong> base fine per step is the fixed overdue amount (does not
              scale with monthly installment).
            </p>
            <p>
              <strong>Proportional mode:</strong> base fine per step = (monthlyAmount ÷ 100) ×
              fineRatePerHundred.
            </p>
            <p>
              Within each maximal consecutive overdue block, the oldest unpaid installment gets
              missed months = N, the next N−1, …, the newest gets 1. Total fine for a line = base ×
              missed months; if missed months ≥ penalty start month, the whole fine is multiplied by
              the penalty multiplier.
            </p>
            <p>
              Penalty from month = missed-month count at which the multiplier starts applying to the
              whole fine.
            </p>
            <p>
              Example (proportional): monthlyAmount 5000, fineRatePerHundred 2 → base 100 per step.
              If penalty start = 2 and multiplier = 1.5, an installment with missed months 1 pays
              100; with missed months 2 pays (100×2)×1.5 = 300.
            </p>
            <p>If penalty fields are empty, defaults are multiplier 1 and start month 1.</p>
          </div>
        </HelpDialogContent>
      </HelpDialog>
    </Dialog>
  );
};

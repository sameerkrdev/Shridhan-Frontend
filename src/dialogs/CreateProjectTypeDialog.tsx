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
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateProjectTypeMutation } from "@/hooks/useFixedDepositApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  computeFdMaturityAmountPreview,
  type MaturityCalculationMethod,
} from "@/lib/fixedDepositApi";

const PREVIEW_DEPOSIT_FALLBACK = 100_000;

const formatRs = (value: number) =>
  `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const schema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(120),
    duration: z
      .number({ message: "Duration is required" })
      .int("Duration must be a whole number")
      .min(1, "Duration must be at least 1 month")
      .max(360),
    minimumAmount: z
      .number({ message: "Minimum amount is required" })
      .min(1, "Minimum amount must be greater than 0")
      .max(100000000),
    maturityCalculationMethod: z.enum([
      "PER_RS_100",
      "MULTIPLE_OF_PRINCIPAL",
      "SIMPLE_INTEREST",
      "COMPOUNDING_INTEREST",
    ]),
    maturityValue: z
      .number({ message: "Maturity value is required" })
      .refine((v) => !Number.isNaN(v), "Enter a valid number"),
  })
  .superRefine((data, ctx) => {
    if (data.maturityCalculationMethod === "PER_RS_100") {
      if (data.maturityValue < 1 || data.maturityValue > 100000) {
        ctx.addIssue({
          code: "custom",
          path: ["maturityValue"],
          message: "Return per Rs.100 must be between 1 and 100000",
        });
      }
    } else if (
      data.maturityCalculationMethod === "SIMPLE_INTEREST" ||
      data.maturityCalculationMethod === "COMPOUNDING_INTEREST"
    ) {
      if (data.maturityValue < 0.01 || data.maturityValue > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["maturityValue"],
          message: "Annual interest rate must be between 0.01 and 100",
        });
      }
    } else if (data.maturityValue < 0.1 || data.maturityValue > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["maturityValue"],
        message: "Maturity multiple must be between 0.1 and 100",
      });
    }
  });

type FormData = z.infer<typeof schema>;

interface CreateProjectTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyId: string;
}

export const CreateProjectTypeDialog = ({
  open,
  onOpenChange,
  societyId,
}: CreateProjectTypeDialogProps) => {
  const mutation = useCreateProjectTypeMutation(societyId);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      duration: undefined,
      minimumAmount: undefined,
      maturityCalculationMethod: "PER_RS_100",
      maturityValue: undefined,
    },
  });

  const [duration, minimumAmount, maturityValue, maturityCalculationMethod] = useWatch({
    control,
    name: ["duration", "minimumAmount", "maturityValue", "maturityCalculationMethod"],
  });

  const maturityCalculationMethodSafe =
    (maturityCalculationMethod as MaturityCalculationMethod | undefined) ?? "PER_RS_100";

  const previewRows = useMemo(() => {
    const deposits: number[] = [];
    if (typeof minimumAmount === "number" && !Number.isNaN(minimumAmount) && minimumAmount >= 1) {
      deposits.push(minimumAmount);
    }
    deposits.push(PREVIEW_DEPOSIT_FALLBACK);
    const unique = Array.from(new Set(deposits));

    if (
      typeof maturityValue !== "number" ||
      Number.isNaN(maturityValue) ||
      typeof duration !== "number" ||
      Number.isNaN(duration) ||
      duration < 1
    ) {
      return { rows: [] as Array<{ deposit: number; maturity: number }>, months: duration ?? null };
    }

    const synthetic = {
      maturityCalculationMethod: maturityCalculationMethodSafe,
      maturityAmountPerHundred: String(maturityValue),
      maturityMultiple: String(maturityValue),
      duration,
    };

    const rows = unique.map((deposit) => ({
      deposit,
      maturity: computeFdMaturityAmountPreview(deposit, synthetic) ?? 0,
    }));

    return { rows, months: duration };
  }, [duration, maturityCalculationMethodSafe, maturityValue, minimumAmount]);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync({
        name: values.name,
        duration: values.duration,
        minimumAmount: values.minimumAmount,
        maturityCalculationMethod: values.maturityCalculationMethod,
        maturityValue: values.maturityValue,
      });
      toast.success("Project type created");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create project type"));
    }
  };

  const valueLabel =
    maturityCalculationMethodSafe === "PER_RS_100"
      ? "Return per Rs.100"
      : maturityCalculationMethodSafe === "SIMPLE_INTEREST" ||
          maturityCalculationMethodSafe === "COMPOUNDING_INTEREST"
        ? "Annual interest rate (% p.a.)"
        : "Maturity multiple (× principal)";
  const valuePlaceholder =
    maturityCalculationMethodSafe === "PER_RS_100"
      ? "Enter return per Rs.100"
      : maturityCalculationMethodSafe === "SIMPLE_INTEREST" ||
          maturityCalculationMethodSafe === "COMPOUNDING_INTEREST"
        ? "e.g. 7.5 for 7.5% per year"
        : "Enter maturity multiple";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Project Type</DialogTitle>
          <DialogDescription>Define a fixed deposit plan configuration.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel htmlFor="fd-project-name">Name</RequiredLabel>
            <Input id="fd-project-name" placeholder="Enter plan name" {...register("name")} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <RequiredLabel htmlFor="fd-project-duration">Duration (months)</RequiredLabel>
              <Input
                id="fd-project-duration"
                type="number"
                placeholder="Enter duration"
                {...register("duration", { valueAsNumber: true })}
              />
              {errors.duration ? (
                <p className="text-sm text-destructive">{errors.duration.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="fd-project-minimum">Minimum Amount</RequiredLabel>
              <Input
                id="fd-project-minimum"
                type="number"
                step="0.01"
                placeholder="Enter minimum amount"
                {...register("minimumAmount", { valueAsNumber: true })}
              />
              {errors.minimumAmount ? (
                <p className="text-sm text-destructive">{errors.minimumAmount.message}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel>Maturity calculation</RequiredLabel>
              <Select
                value={maturityCalculationMethodSafe}
                onValueChange={(value) =>
                  setValue("maturityCalculationMethod", value as MaturityCalculationMethod, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_RS_100">Return per Rs.100</SelectItem>
                  <SelectItem value="MULTIPLE_OF_PRINCIPAL">
                    Maturity multiple (× principal)
                  </SelectItem>
                  <SelectItem value="SIMPLE_INTEREST">
                    Simple interest at maturity (principal + P×r×t)
                  </SelectItem>
                  <SelectItem value="COMPOUNDING_INTEREST">
                    Compounding interest (principal × (1+r)^t, t = years)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <RequiredLabel htmlFor="fd-project-maturity-value">{valueLabel}</RequiredLabel>
              <Input
                id="fd-project-maturity-value"
                type="number"
                step="0.01"
                placeholder={valuePlaceholder}
                {...register("maturityValue", { valueAsNumber: true })}
              />
              {errors.maturityValue ? (
                <p className="text-sm text-destructive">{errors.maturityValue.message}</p>
              ) : null}
            </div>
          </div>

          {previewRows.rows.length > 0 && previewRows.months ? (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Maturity preview (example deposits)</p>
                <p className="text-xs text-muted-foreground">
                  Uses your duration ({previewRows.months} months), minimum (if set), and maturity
                  settings. Second row uses Rs. {PREVIEW_DEPOSIT_FALLBACK.toLocaleString("en-IN")}{" "}
                  for comparison.
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Example deposit</TableHead>
                    <TableHead className="text-right">Maturity amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.rows.map((row) => (
                    <TableRow key={row.deposit}>
                      <TableCell className="font-medium">{formatRs(row.deposit)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatRs(row.maturity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Enter duration, minimum amount, and maturity value to see example maturity amounts.
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

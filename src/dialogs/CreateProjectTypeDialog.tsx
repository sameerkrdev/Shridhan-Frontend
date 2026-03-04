import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateProjectTypeMutation } from "@/hooks/useFixedDepositApi";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiError";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  duration: z.number().int().min(1, "Duration must be at least 1 month").max(360),
  maturityAmountPerHundred: z.number().min(1, "Return amount must be greater than 0").max(100000),
  maturityMultiple: z.number().min(0.1, "Maturity multiple must be greater than 0").max(100),
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
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      duration: 12,
      maturityAmountPerHundred: 150,
      maturityMultiple: 1.5,
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (values: FormData) => {
    try {
      await mutation.mutateAsync(values);
      toast.success("Project type created");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to create project type"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create Project Type</DialogTitle>
          <DialogDescription>Define a fixed deposit plan configuration.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <RequiredLabel htmlFor="fd-project-name">Name</RequiredLabel>
            <Input id="fd-project-name" placeholder="FD 12 Month" {...register("name")} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <RequiredLabel htmlFor="fd-project-duration">Duration (months)</RequiredLabel>
              <Input
                id="fd-project-duration"
                type="number"
                {...register("duration", { valueAsNumber: true })}
              />
              {errors.duration ? (
                <p className="text-sm text-destructive">{errors.duration.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel htmlFor="fd-project-return">Maturity Amount Per 100</RequiredLabel>
              <Input
                id="fd-project-return"
                type="number"
                step="0.01"
                {...register("maturityAmountPerHundred", { valueAsNumber: true })}
              />
              {errors.maturityAmountPerHundred ? (
                <p className="text-sm text-destructive">{errors.maturityAmountPerHundred.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="fd-project-multiple">Maturity Multiple</RequiredLabel>
            <Input
              id="fd-project-multiple"
              type="number"
              step="0.01"
              {...register("maturityMultiple", { valueAsNumber: true })}
            />
            {errors.maturityMultiple ? (
              <p className="text-sm text-destructive">{errors.maturityMultiple.message}</p>
            ) : null}
          </div>

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

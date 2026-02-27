import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";

import { onboardingSchema, type OnboardingSchemaType } from "@/lib/OnboardingZodValidatorSchema";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import LocationSelect from "@/components/ui/location-select";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useCreateSocietyMutation } from "@/hooks/useAuthApi";
import { useAuthSessionStore } from "@/store/authSessionStore";
import { getApiErrorMessage, getApiValidationErrors } from "@/lib/apiError";

const OnboardingForm = () => {
  const navigate = useNavigate();
  const createSocietyMutation = useCreateSocietyMutation();
  const setSelectedSociety = useAuthSessionStore((state) => state.setSelectedSociety);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<OnboardingSchemaType>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      societyName: "",
      subdomain: "",
      zipcode: "",
      logo: undefined,
      country: "",
      state: "",
      city: "",
    },
  });

  const onSubmit = async (data: OnboardingSchemaType) => {
    setFormError(null);
    clearErrors();
    try {
      const payload = await createSocietyMutation.mutateAsync({
        name: data.societyName,
        subDomainName: data.subdomain,
        country: data.country,
        state: data.state,
        city: data.city,
        zipcode: data.zipcode,
        logoUrl: "https://dummy.local/logo.png",
      });

      setSelectedSociety({
        memberId: payload.membership.id,
        societyId: payload.society.id,
        role: payload.membership.role,
        societyName: payload.society.name,
        subDomainName: payload.society.subDomainName,
        status: payload.society.status,
      });

      navigate("/onboarding/permit");
    } catch (error) {
      const backendFieldErrors = getApiValidationErrors(error);
      const fieldMap: Partial<Record<string, keyof OnboardingSchemaType>> = {
        name: "societyName",
        subDomainName: "subdomain",
        country: "country",
        state: "state",
        city: "city",
        zipcode: "zipcode",
      };

      const mappedEntries = Object.entries(backendFieldErrors)
        .map(([key, value]) => {
          const targetField = fieldMap[key];
          return targetField ? ([targetField, value] as const) : null;
        })
        .filter((entry): entry is readonly [keyof OnboardingSchemaType, string] => Boolean(entry));

      mappedEntries.forEach(([field, message]) => {
        setError(field, { type: "server", message });
      });

      const message = getApiErrorMessage(error, "Unable to create society");
      if (mappedEntries.length === 0) {
        setFormError(message);
      }
      toast.error(message);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="gap-4">
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          {/* SOCIETY NAME */}
          <Field>
            <FieldLabel>
              Society Name <span className="text-red-500">*</span>
            </FieldLabel>
            <Input {...register("societyName")} placeholder="My Co-op Society" />
            {errors.societyName && (
              <p className="text-red-500 text-sm">{errors.societyName.message}</p>
            )}
          </Field>

          {/* SUBDOMAIN */}
          <Field>
            <FieldLabel>
              Subdomain <span className="text-red-500">*</span>
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Input {...register("subdomain")} placeholder="my-society" />
              <span className="text-muted-foreground">.shridhan.app</span>
            </div>
            {errors.subdomain && <p className="text-red-500 text-sm">{errors.subdomain.message}</p>}
          </Field>

          {/* LOCATION SELECT */}
          <LocationSelect control={control} setValue={setValue} errors={errors} />

          {/* ZIPCODE */}
          <Field>
            <FieldLabel>
              Zipcode <span className="text-red-500">*</span>
            </FieldLabel>
            <Input {...register("zipcode")} placeholder="400001" />
            {errors.zipcode && <p className="text-red-500 text-sm">{errors.zipcode.message}</p>}
          </Field>

          {/* LOGO */}
          <Field>
            <FieldLabel>Logo</FieldLabel>
            <Input type="file" {...register("logo")} accept="image/*" />
          </Field>

          <Button type="submit" className="w-full mt-4" disabled={createSocietyMutation.isPending}>
            {createSocietyMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Creating Society...
              </span>
            ) : (
              "Next → Proceed to Payment"
            )}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
};

export default OnboardingForm;

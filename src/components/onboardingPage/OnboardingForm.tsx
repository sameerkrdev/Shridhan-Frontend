import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { onboardingSchema, type OnboardingSchemaType } from "@/lib/OnboardingZodValidatorSchema";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import LocationSelect from "@/components/ui/location-select";
import { useNavigate } from "react-router";

const OnboardingForm = () => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    control,
    setValue,
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

  const onSubmit = (data: OnboardingSchemaType) => {
    console.log("Final Form:", data);

    // TODO: Redirect to rezorpay mandate page and then redirect to dashboard page
    // window.location.href = "/api/payment/razorpay/subscription";

    navigate("/");
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup className="gap-4">
          {/* SOCIETY NAME */}
          <Field>
            <FieldLabel>Society Name</FieldLabel>
            <Input {...register("societyName")} placeholder="My Co-op Society" />
            {errors.societyName && (
              <p className="text-red-500 text-sm">{errors.societyName.message}</p>
            )}
          </Field>

          {/* SUBDOMAIN */}
          <Field>
            <FieldLabel>Subdomain</FieldLabel>
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
            <FieldLabel>Zipcode</FieldLabel>
            <Input {...register("zipcode")} placeholder="400001" />
            {errors.zipcode && <p className="text-red-500 text-sm">{errors.zipcode.message}</p>}
          </Field>

          {/* LOGO */}
          <Field>
            <FieldLabel>Logo</FieldLabel>
            <Input type="file" {...register("logo")} accept="image/*" />
          </Field>

          <Button type="submit" className="w-full mt-4">
            Next → Proceed to Payment
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
};

export default OnboardingForm;

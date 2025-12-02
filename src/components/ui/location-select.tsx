import { useMemo } from "react";
import { Country, State, City } from "country-state-city";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { Field, FieldLabel } from "@/components/ui/field";
import { type Control, useController } from "react-hook-form";
import type { OnboardingSchemaType } from "@/lib/OnboardingZodValidatorSchema";

interface LocationSelectProps {
  control: Control<OnboardingSchemaType>;
  setValue: (field: keyof OnboardingSchemaType, value: string) => void;
  errors: any;
}

const LocationSelect: React.FC<LocationSelectProps> = ({ control, setValue, errors }) => {
  const countries = Country.getAllCountries();

  // RHF fields
  const { field: countryField } = useController({ name: "country", control });

  const { field: stateField } = useController({ name: "state", control });

  const { field: cityField } = useController({ name: "city", control });

  const states = useMemo(() => {
    if (!countryField.value) return [];
    return State.getStatesOfCountry(countryField.value);
  }, [countryField.value]);

  const cities = useMemo(() => {
    if (!countryField.value || !stateField.value) return [];
    return City.getCitiesOfState(countryField.value, stateField.value);
  }, [countryField.value, stateField.value]);

  return (
    <>
      {/* COUNTRY */}
      <Field>
        <FieldLabel>Country</FieldLabel>

        <Select
          onValueChange={(value) => {
            countryField.onChange(value);
            setValue("state", "");
            setValue("city", "");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((c) => (
              <SelectItem key={c.isoCode} value={c.isoCode}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {errors.country && <p className="text-red-500 text-sm">{errors.country.message}</p>}
      </Field>

      {/* STATE */}
      <Field>
        <FieldLabel>State</FieldLabel>

        <Select
          disabled={!countryField.value}
          onValueChange={(value) => {
            stateField.onChange(value);
            setValue("city", "");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select State" />
          </SelectTrigger>
          <SelectContent>
            {states.map((s) => (
              <SelectItem key={s.isoCode} value={s.isoCode}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {errors.state && <p className="text-red-500 text-sm">{errors.state.message}</p>}
      </Field>

      {/* CITY */}
      <Field>
        <FieldLabel>City</FieldLabel>

        <Select disabled={!stateField.value} onValueChange={(value) => cityField.onChange(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select City" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {errors.city && <p className="text-red-500 text-sm">{errors.city.message}</p>}
      </Field>
    </>
  );
};

export default LocationSelect;

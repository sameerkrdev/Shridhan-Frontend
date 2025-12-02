import { z } from "zod";

export const onboardingSchema = z.object({
  societyName: z.string().min(3, "Society name is required"),
  subdomain: z.string().min(3, "Subdomain is required"),
  country: z.string().min(1, "Country is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  zipcode: z.string().min(4, "Zipcode is required"),
  logo: z.any().optional(),
});

export type OnboardingSchemaType = z.infer<typeof onboardingSchema>;

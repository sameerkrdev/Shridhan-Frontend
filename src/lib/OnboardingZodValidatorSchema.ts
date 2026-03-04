import { z } from "zod";

export const onboardingSchema = z.object({
  societyName: z.string().trim().min(2, "Name is too short"),
  subdomain: z
    .string()
    .trim()
    .min(3, "Subdomain must be at least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Invalid subdomain format"),
  country: z.string().trim().min(2, "Country is required"),
  state: z.string().trim().min(2, "State is required"),
  city: z.string().trim().min(2, "City is required"),
  zipcode: z
    .string()
    .trim()
    .min(4, "Zip code is too short")
    .max(10, "Zip code is too long"),
  logo: z.any().optional(),
});

export type OnboardingSchemaType = z.infer<typeof onboardingSchema>;

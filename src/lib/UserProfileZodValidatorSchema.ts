import { z } from "zod";

export const userProfileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10,15}$/, "Phone number must be 10 to 15 digits"),
});

export type UserProfileUpdateSchema = z.infer<typeof userProfileUpdateSchema>;

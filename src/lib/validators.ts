import { z } from 'zod';

/** Reusable Zod primitives so validation rules stay consistent across forms. */
export const uuidSchema = z.string().uuid();

export function isUUID(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');

export const indianPhoneSchema = z
  .string()
  .trim()
  .regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.');

/** Crockford base32 alphabet (no I, L, O, U) — matches the join code generator. */
export const joinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6,8}$/, 'Join codes are 6–8 letters and digits.');

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.');

export const paiseSchema = z.number().int().nonnegative();

export const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(80),
  phone: indianPhoneSchema.optional().or(z.literal('')),
  dateOfBirth: isoDateSchema.optional().or(z.literal('')),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const createAcademyFormSchema = z.object({
  name: z.string().trim().min(2, 'Academy name must be at least 2 characters.').max(120),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  timezone: z.string().min(1),
  feeMode: z.enum(['player_pays', 'academy_pays']),
});

export type CreateAcademyFormValues = z.infer<typeof createAcademyFormSchema>;

export const joinAcademyFormSchema = z.object({
  code: joinCodeSchema,
  message: z.string().trim().max(280).optional().or(z.literal('')),
});

export type JoinAcademyFormValues = z.infer<typeof joinAcademyFormSchema>;

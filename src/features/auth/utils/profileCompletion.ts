import type { Profile } from '@/types';

export type MissingProfileField = 'fullName';

/**
 * Checks whether a user's general profile onboarding is complete.
 * Once a user signs in with Gmail or has a full name / email, their profile is complete.
 * Phone numbers are not required for sign-in.
 */
export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;
  const hasName = Boolean(profile.fullName && profile.fullName.trim().length > 0);
  const hasEmail = Boolean(profile.email && profile.email.trim().length > 0);
  return hasName || hasEmail;
}

/**
 * Returns an array of specific fields that are missing from the user's profile.
 */
export function getMissingProfileFields(profile: Profile | null): MissingProfileField[] {
  if (!profile) return ['fullName'];
  const missing: MissingProfileField[] = [];
  if (!profile.fullName || profile.fullName.trim().length === 0) missing.push('fullName');
  return missing;
}

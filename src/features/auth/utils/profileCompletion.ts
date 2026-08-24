import type { Profile } from '@/types';

export type MissingProfileField = 'fullName' | 'dateOfBirth' | 'phone' | 'phoneVerified';

/**
 * Checks whether a user's general profile onboarding is 100% complete.
 * A profile is complete when the user has a valid Full Name, Date of Birth, Phone number,
 * and verified phone status.
 */
export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;
  const hasName = Boolean(profile.fullName && profile.fullName.trim().length > 0);
  const hasDob = Boolean(profile.dateOfBirth && profile.dateOfBirth.trim().length > 0);
  const hasPhone = Boolean(profile.phone && profile.phone.trim().length > 0);
  const isPhoneVerified = profile.phoneVerified === true;
  return hasName && hasDob && hasPhone && isPhoneVerified;
}

/**
 * Returns an array of specific fields that are missing from the user's profile.
 * If a returning user only has one field missing, the UI can present only the missing input.
 */
export function getMissingProfileFields(profile: Profile | null): MissingProfileField[] {
  if (!profile) return ['fullName', 'dateOfBirth', 'phone', 'phoneVerified'];
  const missing: MissingProfileField[] = [];
  if (!profile.fullName || profile.fullName.trim().length === 0) missing.push('fullName');
  if (!profile.dateOfBirth || profile.dateOfBirth.trim().length === 0) missing.push('dateOfBirth');
  if (!profile.phone || profile.phone.trim().length === 0) missing.push('phone');
  if (!profile.phoneVerified) missing.push('phoneVerified');
  return missing;
}

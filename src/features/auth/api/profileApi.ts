import { toApiError, unwrap } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { Profile, UUID } from '@/types';

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  phone_verified?: boolean;
  avatar_url: string | null;
  date_of_birth: string | null;
  locale: string;
  timezone: string;
  is_super_admin: boolean;
};

const PROFILE_COLUMNS =
  'id, full_name, email, phone, phone_verified, avatar_url, date_of_birth, locale, timezone, is_super_admin';

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    phoneVerified: row.phone_verified ?? Boolean(row.phone && row.phone.trim().length > 0),
    avatarUrl: row.avatar_url,
    dateOfBirth: row.date_of_birth,
    locale: row.locale,
    timezone: row.timezone,
    isSuperAdmin: row.is_super_admin,
  };
}

/**
 * Reads the signed-in user's profile. The row is created by the
 * `handle_new_user` trigger on sign-up, but a first-load race (or a user created
 * before the trigger existed) is repaired here rather than failing the app.
 */
export async function fetchMyProfile(userId: UUID): Promise<Profile | null> {
  const row = await unwrap<ProfileRow | null>(
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
  );
  return row ? toProfile(row) : null;
}

export async function ensureMyProfile(
  userId: UUID,
  fallback: { email: string; fullName?: string | null; avatarUrl?: string | null },
): Promise<Profile> {
  const existing = await fetchMyProfile(userId);
  if (existing) return existing;

  const row = await unwrap<ProfileRow>(
    supabase
      .from('profiles')
      .insert({
        id: userId,
        email: fallback.email,
        full_name: fallback.fullName ?? null,
        avatar_url: fallback.avatarUrl ?? null,
      })
      .select(PROFILE_COLUMNS)
      .single(),
  );
  return toProfile(row);
}

export type UpdateProfileInput = {
  fullName?: string;
  phone?: string | null;
  phoneVerified?: boolean;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
  timezone?: string;
  locale?: string;
};

export async function updateMyProfile(userId: UUID, input: UpdateProfileInput): Promise<Profile> {
  const row = await unwrap<ProfileRow>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('profiles')
      .update({
        ...(input.fullName === undefined ? null : { full_name: input.fullName }),
        ...(input.phone === undefined ? null : { phone: input.phone || null }),
        ...(input.phoneVerified === undefined ? null : { phone_verified: input.phoneVerified }),
        ...(input.avatarUrl === undefined ? null : { avatar_url: input.avatarUrl || null }),
        ...(input.dateOfBirth === undefined ? null : { date_of_birth: input.dateOfBirth || null }),
        ...(input.timezone === undefined ? null : { timezone: input.timezone }),
        ...(input.locale === undefined ? null : { locale: input.locale }),
      })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single(),
  );
  return toProfile(row);
}

export async function removeAvatar(userId: UUID, avatarUrl: string): Promise<void> {
  if (!avatarUrl.includes('/storage/v1/object/public/avatars/')) return;
  // Strip query params if any exist (e.g. cache busters)
  const baseUrl = avatarUrl.split('?')[0];
  if (!baseUrl) return;
  const oldPath = baseUrl.split('/storage/v1/object/public/avatars/')[1];
  if (oldPath && oldPath.startsWith(`${userId}/`)) {
    const { error } = await supabase.storage.from('avatars').remove([oldPath]);
    if (error) {
      console.warn('[PFP] failed to remove old avatar:', error);
    }
  }
}

export async function uploadAvatar(userId: UUID, file: File | Blob): Promise<string> {
  const isFile = file instanceof File;
  const fileName = isFile && file.name ? file.name : 'avatar.jpg';
  let fileType = file.type;

  // Fallback if mime type is missing
  if (!fileType) {
    if (fileName.match(/\.(jpg|jpeg)$/i)) fileType = 'image/jpeg';
    else if (fileName.match(/\.png$/i)) fileType = 'image/png';
    else if (fileName.match(/\.webp$/i)) fileType = 'image/webp';
    else fileType = 'image/jpeg';
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  // Use a completely unique timestamp-based path to guarantee no server-side cache collisions
  const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  // Some Android WebViews fail to send File objects directly, so we attempt ArrayBuffer conversion
  let uploadBody: Blob | File = file;
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > 0) {
      uploadBody = new Blob([arrayBuffer], { type: fileType });
    }
  } catch (err: unknown) {
    console.warn('[PFP] ArrayBuffer conversion failed, falling back to raw file', err);
  }

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, uploadBody, {
      upsert: true,
      contentType: fileType,
    });

  if (uploadError) throw toApiError(uploadError);

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

  // Append a cache-buster query parameter to force the browser/WebView to bypass its local image cache
  return `${data.publicUrl}?t=${Date.now()}`;
}

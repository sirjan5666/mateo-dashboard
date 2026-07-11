// Fixed catalog of cartoon baby avatars. The image files live in
// `client/public/avatars/{key}.png` (sliced from the shared avatar grid).
// A baby's `avatar` field stores just the key (e.g. "boy-03"); build the URL
// with `avatarUrl`. Keys are validated server-side against /^(boy|girl)-\d{2}$/.

export const BOY_COUNT = 9;
export const GIRL_COUNT = 9;

function keys(prefix: 'boy' | 'girl', count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);
}

export const BOY_AVATARS = keys('boy', BOY_COUNT);
export const GIRL_AVATARS = keys('girl', GIRL_COUNT);

/** Avatar keys for a baby's sex, in catalog order. */
export function avatarsForSex(sex: 'male' | 'female' | ''): string[] {
  if (sex === 'male') return BOY_AVATARS;
  if (sex === 'female') return GIRL_AVATARS;
  return [];
}

/** Public URL for an avatar key, or null when unset/invalid. */
export function avatarUrl(avatar?: string | null): string | null {
  if (!avatar || !/^(boy|girl)-\d{2}$/.test(avatar)) return null;
  return `/avatars/${avatar}.png`;
}

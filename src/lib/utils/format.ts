/** Small display helpers shared across features. */
export function initials(name: string | null | undefined, fallback = '?'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part[0] ?? '').join('');
  return letters.toUpperCase() || fallback;
}

export function percent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function truncate(value: string, max = 80): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

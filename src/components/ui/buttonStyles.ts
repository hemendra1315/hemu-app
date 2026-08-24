import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg hover:opacity-90',
  secondary: 'bg-surface-muted text-fg border border-border-subtle hover:bg-surface',
  ghost: 'text-fg hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:opacity-90',
  link: 'text-primary underline-offset-4 hover:underline',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 md:h-8 px-3 text-xs md:text-sm min-h-[36px] touch-manipulation',
  md: 'h-12 md:h-10 px-4 text-base md:text-sm min-h-[48px] md:min-h-[40px] font-medium touch-manipulation',
  lg: 'h-14 md:h-12 px-6 text-base min-h-[52px] md:min-h-[48px] font-semibold touch-manipulation',
  icon: 'h-11 w-11 md:h-10 md:w-10 min-h-[44px] min-w-[44px] md:min-h-[40px] md:min-w-[40px] touch-manipulation',
};

/** Shared class list, so router `<Link>`s can look exactly like buttons. */
export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

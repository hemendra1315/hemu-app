import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { buttonStyles, type ButtonSize, type ButtonVariant } from './buttonStyles';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
};

/** Base button: variants, sizes and a loading state that also disables input. */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? isLoading}
      aria-busy={isLoading}
      className={buttonStyles(variant, size, className)}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
    </button>
  );
}

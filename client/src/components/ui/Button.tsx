import type { ButtonHTMLAttributes } from 'react';
import { buttonClass } from './buttonStyles';
import type { ButtonSize, ButtonVariant } from './buttonStyles';

export function Button({
  variant = 'primary',
  size = 'md',
  type,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type ?? 'button'} className={buttonClass(variant, size, className)} {...props} />;
}

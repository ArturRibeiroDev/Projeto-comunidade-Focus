import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'small' | 'medium' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  children,
  className = '',
  icon,
  variant = 'secondary',
  size = 'medium',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button className={`button button-${variant} button-${size} ${className}`.trim()} type={type} {...props}>
      {icon}
      {children}
    </button>
  );
}

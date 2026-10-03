import type { HTMLAttributes } from 'react';

export type BadgeTone = 'orange' | 'green' | 'sky' | 'violet' | 'zinc' | 'red' | 'amber';

export function Badge({
  children,
  className = '',
  tone = 'zinc',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span className={`badge badge-${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

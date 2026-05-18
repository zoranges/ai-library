import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  dot?: boolean;
}

const variantStyles: Record<string, string> = {
  default: 'bg-bg-tertiary text-text-secondary border border-border',
  accent: 'bg-accent/10 text-accent border border-accent/20',
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  error: 'bg-error/10 text-error border border-error/20',
  outline: 'border border-border text-text-secondary',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

const dotColorMap: Record<string, string> = {
  default: 'bg-text-tertiary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  outline: 'bg-text-tertiary',
};

export default function Badge({
  className,
  variant = 'default',
  size = 'md',
  icon,
  dot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium leading-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColorMap[variant])} />
      )}
      {icon && <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      {children}
    </span>
  );
}

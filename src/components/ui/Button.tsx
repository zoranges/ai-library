import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-accent text-surface hover:bg-accent-hover active:bg-accent-hover cartoon-btn cartoon-shadow',
  secondary:
    'bg-accent-subtle text-accent hover:bg-accent-subtle/80 active:bg-accent-subtle/60 cartoon-btn',
  outline:
    'border-[3px] border-border-strong text-text hover:bg-surface-raised active:bg-surface-raised/60 cartoon-btn bubble-border',
  ghost:
    'text-text-secondary hover:bg-surface-raised active:bg-surface-raised/60',
  danger:
    'bg-error text-surface hover:opacity-90 active:opacity-90 cartoon-btn',
};

const sizeStyles: Record<string, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-10 px-5 text-sm gap-2 rounded-2xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors duration-micro ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {!loading && icon && iconPosition === 'left' && (
          <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === 'right' && (
          <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

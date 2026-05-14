import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

function Card({ className, hover = false, padding = 'none', children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-lg border border-border shadow-1',
        hover &&
          'transition-shadow duration-standard ease-out-quart hover:shadow-2 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, title, subtitle, action, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-center justify-between border-b border-border px-4 py-3', className)}
      {...props}
    >
      {title || subtitle ? (
        <div className="flex flex-col">
          {title && (
            <h3 className="text-sm font-semibold text-text font-display">{title}</h3>
          )}
          {subtitle && <p className="text-xs text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
      ) : (
        children
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cn('px-4 py-3', className)} {...props}>
      {children}
    </div>
  );
}

function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn('flex items-center justify-between border-t border-border px-4 py-3', className)}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export { CardHeader, CardBody, CardFooter };
export default Card;

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SelectProps {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function Select({
  className,
  label,
  error,
  options,
  placeholder = '请选择',
  value,
  onChange,
  fullWidth = true,
  disabled,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')} ref={containerRef}>
      {label && (
        <label className="text-[13px] font-medium text-text">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          className={cn(
            'h-10 w-full flex items-center justify-between bg-surface border rounded-md px-3 text-sm text-text transition-[border-color,box-shadow] duration-micro ease-out-quart focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent disabled:opacity-40 disabled:cursor-not-allowed',
            error ? 'border-error focus:ring-error/20 focus:border-error' : 'border-border',
            className
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <span className={cn(!selectedOption && 'text-text-tertiary')}>
            {selectedOption ? (
              <span className="flex items-center gap-2">
                {selectedOption.icon}
                {selectedOption.label}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-text-tertiary transition-transform duration-micro ease-out-quart shrink-0',
              isOpen && 'rotate-180'
            )}
            strokeWidth={1.5}
          />
        </button>
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-surface-raised border border-border rounded-lg shadow-2 animate-dropdown-in overflow-y-auto max-h-60">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-micro ease-out-quart hover:bg-accent-subtle',
                  option.value === value && 'bg-accent-subtle text-accent',
                  option.disabled && 'opacity-40 pointer-events-none'
                )}
                onClick={() => {
                  onChange?.(option.value);
                  setIsOpen(false);
                }}
                disabled={option.disabled}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

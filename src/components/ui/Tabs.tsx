import { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeKey?: string;
  onChange?: (key: string) => void;
  variant?: 'underline' | 'pill';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

export default function Tabs({
  tabs,
  activeKey,
  onChange,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  className,
}: TabsProps) {
  const [internalKey, setInternalKey] = useState(tabs[0]?.key);
  const currentKey = activeKey ?? internalKey;
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (variant !== 'underline') return;
    const el = tabRefs.current.get(currentKey);
    if (el) {
      setIndicator({
        left: el.offsetLeft,
        width: el.offsetWidth,
      });
    }
  }, [currentKey, variant, tabs]);

  function handleTabClick(key: string) {
    if (activeKey === undefined) setInternalKey(key);
    onChange?.(key);
  }

  const sizeStyles = {
    sm: { tab: 'px-3 py-1.5 text-xs', pill: 'px-3 py-1 text-xs' },
    md: { tab: 'px-4 py-2 text-sm', pill: 'px-4 py-1.5 text-sm' },
  };

  return (
    <div className={className}>
      <div
        className={cn(
          'relative flex',
          variant === 'underline' && 'border-b border-border gap-0',
          variant === 'pill' && 'bg-surface-raised rounded-lg p-1 gap-0.5'
        )}
      >
        {variant === 'underline' && (
          <span
            className="absolute bottom-0 h-0.5 bg-accent rounded-full transition-all duration-standard ease-out-quart"
            style={{
              left: indicator.left,
              width: indicator.width,
            }}
          />
        )}
        {tabs.map((tab) => {
          const isActive = tab.key === currentKey;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.key, el);
              }}
              type="button"
              className={cn(
                'inline-flex items-center justify-center gap-1.5 font-medium transition-colors duration-micro ease-out-quart whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                variant === 'underline' &&
                  cn(
                    sizeStyles[size].tab,
                    isActive ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary',
                    fullWidth && 'flex-1'
                  ),
                variant === 'pill' &&
                  cn(
                    sizeStyles[size].pill,
                    'rounded-md',
                    isActive
                      ? 'bg-surface text-text shadow-1'
                      : 'text-text-tertiary hover:text-text-secondary',
                    fullWidth && 'flex-1'
                  ),
                tab.disabled && 'opacity-40 pointer-events-none'
              )}
              onClick={() => handleTabClick(tab.key)}
              disabled={tab.disabled}
            >
              {tab.icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

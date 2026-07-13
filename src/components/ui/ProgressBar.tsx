import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Stage {
  key: string;
  label: string;
}

interface ProgressBarProps {
  stages: Stage[];
  activeStage: string;
  current: number;
  total: number;
  message: string;
}

export default function ProgressBar({ stages, activeStage, current, total, message }: ProgressBarProps) {
  const activeIndex = stages.findIndex(s => s.key === activeStage);

  return (
    <div className="w-full">
      <div className="flex items-center gap-1">
        {stages.map((stage, i) => {
          const completed = i < activeIndex;
          const active = i === activeIndex;
          const isLast = i === stages.length - 1;

          return (
            <div key={stage.key} className={cn('flex items-center', !isLast && 'flex-1')}>
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                    completed && 'bg-accent text-white',
                    active && 'bg-accent text-white ring-4 ring-accent/20 scale-110',
                    !completed && !active && 'bg-bg-tertiary text-text-tertiary',
                  )}
                >
                  {completed ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'text-[10px] mt-1 text-center whitespace-nowrap transition-colors',
                    (completed || active) ? 'text-accent font-semibold' : 'text-text-tertiary',
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 h-0.5 mx-1 mt-[-16px]">
                  <div className="h-full rounded-full bg-bg-tertiary overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        completed ? 'bg-accent w-full' : 'bg-transparent w-0',
                        active && 'bg-accent/30 w-full animate-pulse',
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress text */}
      <div className="mt-3 text-center">
        <p className="text-xs text-text-secondary">{message}</p>
        {total > 0 && (
          <div className="mt-2 w-full bg-bg-tertiary rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${Math.round((current / total) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

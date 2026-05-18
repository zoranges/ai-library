import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyProps {
  icon?: string;
  title?: string;
  description?: string;
  className?: string;
}

export default function Empty({
  title = 'Nothing here yet',
  description = 'No content yet. Start exploring!',
  className,
}: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-2">
        <PackageOpen className="w-8 h-8 text-accent/40" strokeWidth={1.5} />
      </div>
      <h3 className="mt-4 text-sm font-bold text-text-secondary">{title}</h3>
      <p className="mt-1 text-xs text-text-tertiary max-w-xs">{description}</p>
    </div>
  );
}

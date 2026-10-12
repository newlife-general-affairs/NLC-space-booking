import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="w-12 h-12 rounded-2xl bg-surface-sunken text-ink-faint flex items-center justify-center mb-4">
        <Icon size={22} />
      </div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 text-xs text-ink-faint leading-relaxed max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

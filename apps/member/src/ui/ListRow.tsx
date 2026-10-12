import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface ListRowProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}

export function ListRow({ icon, title, subtitle, trailing, onClick, chevron = true }: ListRowProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full min-h-[56px] flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-2xl text-left transition-colors ${
        onClick ? 'active:scale-[0.99] hover:border-primary/30' : ''
      }`}
    >
      {icon && (
        <div className="shrink-0 w-10 h-10 rounded-xl bg-surface-sunken text-ink-soft flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink truncate">{title}</div>
        {subtitle && <div className="text-xs text-ink-soft mt-0.5 truncate">{subtitle}</div>}
      </div>
      {trailing}
      {onClick && chevron && <ChevronRight size={16} className="text-ink-faint shrink-0" />}
    </Comp>
  );
}

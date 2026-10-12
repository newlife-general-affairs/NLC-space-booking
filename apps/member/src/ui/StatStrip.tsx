import type { LucideIcon } from 'lucide-react';

type Tone = 'success' | 'warning' | 'danger';

interface StatStripProps {
  tone: Tone;
  icon: LucideIcon;
  text: string;
  onClick?: () => void;
}

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

const DOT_CLASS: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function StatStrip({ tone, icon: Icon, text, onClick }: StatStripProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-bold ${TONE_CLASS[tone]} ${onClick ? 'text-left active:scale-[0.99]' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[tone]}`} />
      <Icon size={14} className="shrink-0" />
      <span className="flex-1 truncate">{text}</span>
    </Comp>
  );
}

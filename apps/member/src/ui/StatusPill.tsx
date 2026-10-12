import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';

type Tone = 'success' | 'warning' | 'danger' | 'muted';

interface StatusPillProps {
  tone: Tone;
  label: string;
  icon?: LucideIcon;
  pulse?: boolean;
}

const TONE_CLASS: Record<Tone, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  muted: 'badge-muted',
};

const TONE_ICON: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  muted: AlertTriangle,
};

export function StatusPill({ tone, label, icon, pulse = false }: StatusPillProps) {
  const Icon = icon || TONE_ICON[tone];
  return (
    <span className={`${TONE_CLASS[tone]} ${pulse ? 'animate-pulse' : ''}`}>
      <Icon size={12} className="shrink-0" />
      {label}
    </span>
  );
}

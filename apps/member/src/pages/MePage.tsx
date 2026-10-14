import { ChevronRight, LogOut, MapPin, UserRound } from 'lucide-react';
import type { Booking, UserProfile } from '@church/shared/types';
import { Button } from '../ui';
import RecordsPage from './RecordsPage';

interface MePageProps {
  email: string;
  userProfile: UserProfile | null;
  currentBranch: string;
  bookings: Booking[];
  onOpenProfile: () => void;
  onSwitchBranch: () => void;
  onSignOut: () => void;
  onStartCleanup: (booking: Booking) => void;
  onReportIssue: (booking: Booking) => void;
}

export default function MePage({
  email,
  userProfile,
  currentBranch,
  bookings,
  onOpenProfile,
  onSwitchBranch,
  onSignOut,
  onStartCleanup,
  onReportIssue,
}: MePageProps) {
  const displayName = userProfile?.full_name?.trim() || email.split('@')[0];
  const zone = userProfile?.pastoral_zone?.trim();

  return (
    <div className="pt-4 space-y-3">
      <div className="card divide-y divide-border">
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <div className="w-11 h-11 rounded-2xl bg-primary-soft text-primary flex items-center justify-center font-black text-sm shrink-0">
            {displayName.substring(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-black text-ink truncate">{displayName}</div>
            <div className="text-xs text-ink-soft truncate mt-0.5">
              {[zone, userProfile?.phone, email].filter(Boolean).join(' · ')}
            </div>
          </div>
          <span className="flex items-center gap-0.5 text-xs font-bold text-primary shrink-0">
            <UserRound size={13} /> 編輯 <ChevronRight size={13} />
          </span>
        </button>

        <button
          type="button"
          onClick={onSwitchBranch}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <MapPin size={16} className="text-primary shrink-0" />
          <span className="flex-1 text-sm font-bold text-ink">目前據點：{currentBranch}</span>
          <span className="flex items-center gap-0.5 text-xs font-bold text-ink-soft">
            切換 <ChevronRight size={13} />
          </span>
        </button>
      </div>

      <RecordsPage
        bookings={bookings}
        onStartCleanup={onStartCleanup}
        onReportIssue={onReportIssue}
      />

      <Button variant="ghost" fullWidth onClick={onSignOut}>
        <LogOut size={15} /> 登出
      </Button>
    </div>
  );
}

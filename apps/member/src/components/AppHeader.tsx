import { LogOut, MapPin } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AppHeaderProps {
  user: SupabaseUser;
  currentBranch: string | null;
  onLogoClick: () => void;
  onSwitchBranch: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

export default function AppHeader({
  user, currentBranch, onLogoClick, onSwitchBranch, onOpenProfile, onSignOut,
}: AppHeaderProps) {
  const userInitials = user?.email
    ? user.email.split('@')[0].substring(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="app-topbar flex items-center justify-between px-4 gap-2">
      <button
        type="button"
        onClick={onLogoClick}
        className="flex items-center gap-1.5 text-ink font-black text-sm shrink-0 active:scale-95 transition-transform"
        aria-label="返回首頁"
      >
        <span className="text-primary">場地借用</span>
      </button>

      {currentBranch && (
        <button
          type="button"
          onClick={onSwitchBranch}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-sunken text-ink-soft text-xs font-bold active:scale-95 transition-transform"
        >
          <MapPin size={11} className="text-primary shrink-0" />
          <span className="max-w-[96px] truncate">{currentBranch}</span>
        </button>
      )}

      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <button
          type="button"
          onClick={onOpenProfile}
          title={user.email}
          className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center font-black text-xs active:scale-95 transition-transform"
        >
          {userInitials}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          title="登出"
          className="w-8 h-8 rounded-full text-ink-faint hover:text-danger hover:bg-danger/10 flex items-center justify-center active:scale-95 transition-all"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}

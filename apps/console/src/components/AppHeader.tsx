import { Building2, MapPin, LogOut, ChevronDown } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ROLE_LABEL } from '../navigation';

interface AppHeaderProps {
  user: SupabaseUser;
  role: string | null;
  currentBranch: string | null;
  /** 未提供時代表帳號被鎖定在單一據點，據點標籤只顯示不可點 */
  onSwitchBranch?: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

export default function AppHeader({
  user, role, currentBranch, onSwitchBranch, onOpenProfile, onSignOut,
}: AppHeaderProps) {
  const userInitials = user?.email
    ? user.email.split('@')[0].substring(0, 2).toUpperCase()
    : 'U';

  const roleText = ROLE_LABEL[role || ''] || role || '使用者';
  const branchPillClass = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold';

  return (
    <header className="sticky top-0 z-50 h-14 md:h-16 w-full bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="w-full h-full flex items-center justify-between px-4 md:px-6 gap-3">

        <div className="flex items-center gap-2.5 text-slate-800 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
            <Building2 size={16} strokeWidth={2} />
          </div>
          <span className="hidden sm:block text-sm font-bold tracking-tight">空間租借管理</span>
        </div>

        {currentBranch ? (
          onSwitchBranch ? (
            <button
              type="button"
              onClick={onSwitchBranch}
              title="切換據點"
              className={`${branchPillClass} bg-white border-slate-200 hover:border-indigo-300 text-slate-700 transition-colors`}
            >
              <MapPin size={11} className="text-indigo-600" />
              <span>{currentBranch}</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>
          ) : (
            <span className={`${branchPillClass} bg-slate-50 border-slate-200 text-slate-700`}>
              <MapPin size={11} className="text-indigo-600" />
              {currentBranch}
            </span>
          )
        ) : (
          <span className={`${branchPillClass} bg-slate-50 border-slate-200 text-slate-500 font-medium`}>
            <MapPin size={11} />
            未選擇據點
          </span>
        )}

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={onOpenProfile}
            title="編輯個人資料"
            className="flex items-center gap-2.5 px-2 md:px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="hidden md:block text-right">
              <div className="text-xs font-bold text-slate-700 leading-none mb-1 max-w-[160px] truncate">
                {user.email}
              </div>
              <span className="inline-flex rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 border border-indigo-200">
                {roleText}
              </span>
            </div>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-extrabold text-xs">
              {userInitials}
            </div>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            title="登出"
            aria-label="登出"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

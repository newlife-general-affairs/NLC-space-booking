import { Building2, MapPin, User, LogOut, ChevronDown } from 'lucide-react';
import type { ActiveTab } from '@church/shared/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { motion } from 'framer-motion';

interface AppHeaderProps {
  user: SupabaseUser;
  role: string | null;
  currentBranch: string | null;
  activeTab: ActiveTab;
  isAdmin?: boolean;
  onLogoClick: () => void;
  onSwitchBranch: () => void;
  onTabChange: (tab: ActiveTab) => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
  onSwitchMode?: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  system_admin: '系統管理員',
  admin:        '同工',
  inspector:    '查察員',
  user:         '會眾',
};

export default function AppHeader({
  user, role, currentBranch, activeTab, isAdmin,
  onLogoClick, onSwitchBranch, onTabChange, onOpenProfile, onSignOut, onSwitchMode,
}: AppHeaderProps) {
  // Extract initials from user email
  const userInitials = user?.email 
    ? user.email.split('@')[0].substring(0, 2).toUpperCase() 
    : 'U';

  const roleText = ROLE_LABEL[role || ''] || role || '使用者';

  return (
    <header className="sticky top-0 z-50 h-14 md:h-16 w-full bg-surface/95 backdrop-blur-md border-b border-slate-300/20 shadow-sm">
      <div className="w-full h-full flex items-center justify-between px-4 md:px-6 gap-3">

        {/* ── Logo ── */}
        <motion.button
          onClick={onLogoClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2.5 text-zinc-100 hover:text-white transition-colors duration-150 shrink-0 group"
          aria-label="返回首頁"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-400/15 border border-indigo-400/40 text-indigo-400 group-hover:bg-indigo-400/25 group-hover:text-indigo-300 transition-all duration-300">
            <Building2 size={16} strokeWidth={2} />
          </div>
          <span className="hidden sm:block text-sm font-bold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent">
            空間租借系統
          </span>
        </motion.button>

        {/* ── Branch pill ── */}
        {currentBranch ? (
          <motion.button
            onClick={onSwitchBranch}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised border border-slate-300/25 hover:border-indigo-400/60 text-zinc-200 hover:text-white text-xs font-semibold shadow-inner transition-all duration-150"
          >
            <MapPin size={11} className="text-indigo-400" />
            <span>{currentBranch}</span>
            <ChevronDown size={11} className="text-zinc-500 group-hover:text-zinc-300" />
          </motion.button>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/30 border border-zinc-900 text-zinc-600 text-xs font-medium">
            <MapPin size={11} />
            未選擇據點
          </span>
        )}

        {/* ── System admin tab ── */}
        {!currentBranch && role === 'system_admin' && (
          <button
            onClick={() => onTabChange('system')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'system'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            帳戶管理
          </button>
        )}

        {/* ── Right side ── */}
        {user && (
          <div className="flex items-center gap-2 shrink-0 ml-auto">

            {/* Switch mode */}
            {isAdmin && currentBranch && onSwitchMode && (
              <motion.button
                onClick={onSwitchMode}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-lg transition-all focus-visible:outline-none"
                title="返回模式選擇"
              >
                ← 返回模式選擇
              </motion.button>
            )}

            {/* User info — desktop */}
            <motion.button
              onClick={onOpenProfile}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all duration-150 group focus-visible:outline-none"
              title="編輯個人資料"
            >
              <div className="text-right">
                <div className="text-xs font-bold text-zinc-300 group-hover:text-zinc-100 transition-colors leading-none mb-1 max-w-[160px] truncate">
                  {user.email}
                </div>
                <div className="flex justify-end gap-1.5 items-center">
                  <span className="inline-flex rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-400 border border-indigo-500/20">
                    {roleText}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center w-7.5 h-7.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:border-zinc-700 group-hover:text-indigo-400 transition-colors font-extrabold text-xs">
                {userInitials}
              </div>
            </motion.button>

            {/* User icon — mobile */}
            <motion.button
              onClick={onOpenProfile}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-indigo-400 transition-colors focus-visible:outline-none"
              title={user.email}
            >
              <User size={15} />
            </motion.button>

            {/* Sign out */}
            <motion.button
              onClick={onSignOut}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-150 focus-visible:outline-none"
              title="登出"
            >
              <LogOut size={14} />
            </motion.button>
          </div>
        )}
      </div>
    </header>
  );
}

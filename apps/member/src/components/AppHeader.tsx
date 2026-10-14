import { LogOut, MapPin } from 'lucide-react';

interface AppHeaderProps {
  currentBranch: string | null;
  // 尚未選擇據點時沒有底部導覽與「我的」頁，登出只能放在標題列
  onSignOut: () => void;
}

export default function AppHeader({ currentBranch, onSignOut }: AppHeaderProps) {
  return (
    <header className="app-topbar flex items-center justify-between px-4 gap-2">
      <span className="text-primary font-black text-sm shrink-0">場地借用</span>

      {currentBranch ? (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-sunken text-ink-soft text-xs font-bold">
          <MapPin size={11} className="text-primary shrink-0" />
          <span className="max-w-[96px] truncate">{currentBranch}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={onSignOut}
          title="登出"
          className="w-8 h-8 rounded-full text-ink-faint hover:text-danger hover:bg-danger/10 flex items-center justify-center active:scale-95 transition-all"
        >
          <LogOut size={15} />
        </button>
      )}
    </header>
  );
}

import { Calendar, ShieldCheck, ArrowRight } from 'lucide-react';

interface AdminModeSelectorProps {
  currentBranch: string;
  onSelectMode: (mode: 'booking' | 'admin') => void;
  onBack: () => void;
}

export default function AdminModeSelector({
  currentBranch,
  onSelectMode,
  onBack,
}: AdminModeSelectorProps) {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 animate-fade-up">

      {/* Header */}
      <div className="text-center mb-10">
        <span className="badge-brand mb-4 inline-flex">🔒 同工身分已確認</span>
        <h2 className="text-xl font-bold text-white/90 tracking-tight mt-3">
          {currentBranch} — 請選擇操作模式
        </h2>
        <p className="mt-2 text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
          您是本堂會的管理同工。請選擇接下來的操作。
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Booking mode */}
        <button
          onClick={() => onSelectMode('booking')}
          className="group card card-hover card-brand p-6 text-left flex flex-col gap-5 animate-fade-up delay-50"
        >
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600/12 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-600/25 transition-colors">
            <Calendar size={20} strokeWidth={1.75} />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors mb-2">
              場地租借模式
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              以一般使用者身分進行場地預約與空檔查詢。查看每週排程、取得門鎖密碼，並提交場地歸還。
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
            <span className="text-xs font-semibold text-indigo-400">開始租借預約</span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600/12 border border-indigo-500/15 text-indigo-400 group-hover:bg-indigo-600/25 transition-all">
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </button>

        {/* Admin mode */}
        <button
          onClick={() => onSelectMode('admin')}
          className="group relative card p-6 text-left flex flex-col gap-5 animate-fade-up delay-100
                     hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.20)]"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/[0.04] to-transparent pointer-events-none" />

          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 group-hover:bg-violet-500/20 transition-colors relative z-10">
            <ShieldCheck size={20} strokeWidth={1.75} />
          </div>

          <div className="flex-1 relative z-10">
            <h3 className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors mb-2">
              同工管理後台
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              進入行政後台，處理預約審核、場地指派、清潔管理、故障回報與公告編輯。
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.06] relative z-10">
            <span className="text-xs font-semibold text-violet-400">進入管理後台</span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/15 text-violet-400 group-hover:bg-violet-500/25 transition-all">
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </button>

      </div>

      {/* Back */}
      <div className="mt-8 text-center">
        <button
          onClick={onBack}
          className="text-sm font-medium text-slate-300 hover:text-white transition-colors active:scale-[0.97]"
        >
          ← 切換聚點堂會
        </button>
      </div>
    </div>
  );
}

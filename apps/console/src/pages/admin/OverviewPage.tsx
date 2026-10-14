import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ChevronRight, ClipboardCheck, FileInput, RefreshCw, Sparkles, Wrench } from 'lucide-react';
import type { Booking } from '@church/shared/types';
import { hasStarted, isBookingPast, todayStr } from '../../domain/bookingStatus';
import type { ConsoleTodos } from '../../hooks/useConsoleTodos';
import type { PageId } from '../../navigation';

interface OverviewPageProps {
  currentBranch: string;
  isStaff: boolean;
  todos: ConsoleTodos;
  bookings: Booking[];
  onNavigate: (page: PageId) => void;
  onRefresh: () => void;
}

interface TodoCard {
  label: string;
  hint: string;
  count: number;
  icon: LucideIcon;
  page: PageId;
  tone: 'amber' | 'rose' | 'sky' | 'slate';
  staffOnly?: boolean;
}

const TONE: Record<TodoCard['tone'], string> = {
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  slate: 'bg-slate-50 text-slate-600 border-slate-200',
};

function usageLabel(b: Booking) {
  if (isBookingPast(b.booking_date, b.end_time)) return { text: '已結束', cls: 'bg-slate-100 text-slate-500' };
  if (hasStarted(b.booking_date, b.start_time)) return { text: '使用中', cls: 'bg-sky-100 text-sky-700' };
  return { text: '尚未開始', cls: 'bg-emerald-50 text-emerald-700' };
}

export default function OverviewPage({ currentBranch, isStaff, todos, bookings, onNavigate, onRefresh }: OverviewPageProps) {
  const cards: TodoCard[] = [
    { label: '待審核預約', hint: todos.conflicts > 0 ? `其中 ${todos.conflicts} 筆時段衝突` : '尚未過期的申請', count: todos.pendingReview + todos.conflicts, icon: ClipboardCheck, page: 'bookings-review', tone: todos.conflicts > 0 ? 'rose' : 'amber', staffOnly: true },
    { label: '待清潔檢查', hint: '借用人已回報打掃完成', count: todos.cleaningToInspect, icon: Sparkles, page: 'onsite-cleaning', tone: 'amber' },
    { label: '待分配打掃', hint: '已核可、尚未指派公共空間', count: todos.cleaningToAssign, icon: Sparkles, page: 'onsite-cleaning', tone: 'sky' },
    { label: '未處理故障', hint: '待處理或處理中的回報', count: todos.openIssues, icon: Wrench, page: 'onsite-issues', tone: 'rose' },
    { label: '表單匯入待處理', hint: '全系統需人工確認的表單', count: todos.unresolvedIntake, icon: FileInput, page: 'bookings-form-intake', tone: 'slate', staffOnly: true },
  ];
  const visibleCards = cards.filter(c => isStaff || !c.staffOnly);

  const today = todayStr();
  const todayBookings = bookings
    .filter(b => b.status === 'approved' && b.booking_date === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg">今日總覽</h3>
          <p className="text-xs text-slate-500 mt-1">{currentBranch} · {today}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={13} /> 重新整理
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {visibleCards.map(card => (
          <button
            key={card.label}
            type="button"
            onClick={() => onNavigate(card.page)}
            className={`text-left p-4 rounded-2xl border transition-shadow hover:shadow-md ${card.count > 0 ? TONE[card.tone] : TONE.slate}`}
          >
            <div className="flex items-center justify-between">
              <card.icon size={16} />
              <ChevronRight size={14} className="opacity-50" />
            </div>
            <div className="text-2xl font-black mt-2">{card.count}</div>
            <div className="text-xs font-bold mt-0.5">{card.label}</div>
            <div className="text-[11px] opacity-70 mt-0.5 leading-snug">{card.hint}</div>
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-slate-800">今日借用（{todayBookings.length}）</h4>
          {isStaff && (
            <button
              type="button"
              onClick={() => onNavigate('schedule-week')}
              className="text-xs font-bold text-indigo-600 flex items-center gap-0.5"
            >
              看週看板 <ChevronRight size={13} />
            </button>
          )}
        </div>
        {todayBookings.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">今天沒有已核可的借用</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {todayBookings.map(b => {
              const usage = usageLabel(b);
              return (
                <li key={b.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-24 shrink-0 text-xs font-bold text-slate-700 tabular-nums">
                    {b.start_time.substring(0, 5)}–{b.end_time.substring(0, 5)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-800 truncate">{b.rooms?.name || b.room_name}</div>
                    <div className="text-xs text-slate-500 truncate">{b.full_name} · {b.purpose}</div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${usage.cls}`}>{usage.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!isStaff && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <span>現場發現設備損壞或異常，請到「現場 → 故障回報」填寫回報。</span>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Calendar,
  ClipboardList,
  Megaphone,
  ChevronDown,
  AlertOctagon,
  Eye,
  AlertTriangle,
  Sun,
  Moon,
  Coffee,
  BookOpen,
  Lightbulb,
} from 'lucide-react';
import type { Announcement, DisqualifiedZone, UserProfile, ViolationSummary } from '@church/shared/types';
import { apiFetchPastorStatus } from '@church/shared/api';
import { Button, EmptyState, ListRow, PullToRefresh, Sheet, StatStrip } from '../ui';

interface HomePageProps {
  user: User & { email: string };
  userProfile: UserProfile | null;
  announcements: Announcement[];
  disqualifiedZones?: DisqualifiedZone[];
  isAdmin?: boolean;
  getToken?: () => string;
  onRefresh?: () => Promise<void>;
}

const GREETING_ICON = { moon: Moon, sun: Sun, coffee: Coffee };

function getGreeting() {
  const hr = new Date().getHours();
  if (hr < 5) return { text: '深夜好', icon: GREETING_ICON.moon };
  if (hr < 14) return { text: hr < 11 ? '早安' : '午安', icon: GREETING_ICON.sun };
  if (hr < 18) return { text: '下午好', icon: GREETING_ICON.coffee };
  return { text: '晚安', icon: GREETING_ICON.moon };
}

export default function HomePage({
  user,
  userProfile,
  announcements,
  disqualifiedZones = [],
  isAdmin = false,
  getToken,
  onRefresh,
}: HomePageProps) {
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const [showAllAnn, setShowAllAnn] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).substring(0, 7)
  );
  const [violationSummary, setViolationSummary] = useState<ViolationSummary | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalPastoralZone, setModalPastoralZone] = useState<string>('');

  useEffect(() => {
    if (showViolationModal && modalPastoralZone && getToken) {
      setModalLoading(true);
      apiFetchPastorStatus(getToken(), modalPastoralZone, selectedMonth)
        .then(res => setViolationSummary(res))
        .catch(console.error)
        .finally(() => setModalLoading(false));
    }
  }, [showViolationModal, selectedMonth, modalPastoralZone, getToken]);

  const openZoneDetail = (zone: string, month?: string) => {
    setModalPastoralZone(zone);
    if (month) setSelectedMonth(month);
    setShowViolationModal(true);
  };

  const RulesAccordion = () => (
    <div className="text-xs mt-3">
      <button
        type="button"
        onClick={() => setShowRules(prev => !prev)}
        className="text-primary font-bold flex items-center gap-1.5"
      >
        <BookOpen size={13} className="shrink-0" />
        <span>檢視空間借用與停權管理規則</span>
        <span className="text-[10px] text-ink-faint font-semibold">{showRules ? '▲ 收起' : '▼ 展開'}</span>
      </button>
      {showRules && (
        <div className="mt-2.5 p-3.5 bg-surface-sunken rounded-xl space-y-2 text-[11px] leading-relaxed text-ink-soft">
          <p><strong>記點與違規機制</strong>：每次借用若發生「租借未使用」、「未完整復歸場地（未關冷氣/大燈、未帶走垃圾等）」或「超時歸還」，將會記錄違規記點（未完整復歸場地僅扣 1 點且不計入違規次數）。</p>
          <p><strong>停權標準</strong>：當牧區在前一個月份累計扣點達 <strong>5 點</strong> 或違規達 <strong>2 次</strong>。</p>
          <p><strong>停權處分</strong>：符合停權標準之牧區，將於次月暫停該牧區所有人員的場地借用與預約資格。</p>
        </div>
      )}
    </div>
  );

  // ── 首頁 ──────────────────────────────────────────────────
  const greeting = getGreeting();
  const allAnnouncements = announcements.filter(a => a.is_active !== false);
  const visibleAnnouncements = showAllAnn ? allAnnouncements : allAnnouncements.slice(0, 3);

  const userPastoralZone = userProfile?.pastoral_zone?.trim();
  const hasPastoralZone = !!userPastoralZone && !['無牧區', '未知牧區', '其他', 'other'].includes(userPastoralZone);
  const userDisqualifiedRecords = hasPastoralZone
    ? disqualifiedZones.filter(z => z.pastoralZone === userPastoralZone)
    : [];
  const isUserSuspended = userDisqualifiedRecords.length > 0;

  const renderStatusStrip = () => {
    if (isAdmin) {
      if (disqualifiedZones.length === 0) {
        return <StatStrip tone="success" icon={Sun} text="目前所有牧區借用資格正常" onClick={() => setShowRules(v => !v)} />;
      }
      return (
        <div className="rounded-2xl bg-danger/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-danger font-bold text-xs">
            <AlertTriangle size={15} className="shrink-0" />
            <span>牧區停權公告（本月份暫停借用資格）</span>
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
            {disqualifiedZones.map((zone, i) => (
              <ListRow
                key={i}
                onClick={() => openZoneDetail(zone.pastoralZone, zone.reasonMonth)}
                title={zone.pastoralZone}
                subtitle={`累計 ${zone.totalPoints ?? 0} 點 · 違規 ${zone.totalCount ?? 0} 次`}
                icon={<Eye size={16} />}
              />
            ))}
          </div>
          <RulesAccordion />
        </div>
      );
    }

    if (!hasPastoralZone) {
      return (
        <div className="rounded-2xl bg-warning/10 p-4">
          <div className="flex items-center gap-1.5 text-ink font-bold text-xs">
            <Lightbulb size={15} className="text-warning shrink-0" />
            <span>提示：尚未設定所屬牧區</span>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-soft leading-relaxed">
            請前往右上角「個人資料」選填您的牧區，設定後即可即時監測借用資格與違規記點狀況。
          </p>
        </div>
      );
    }

    if (isUserSuspended) {
      return (
        <div className="rounded-2xl bg-danger/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-danger font-bold text-xs">
            <AlertTriangle size={15} className="shrink-0" />
            <span>牧區「{userPastoralZone}」預約資格已被暫停</span>
          </div>
          <p className="text-[11px] text-ink-soft leading-relaxed">
            因前月份累計違規記點已達停權上限，本月份暫停該牧區所有人員的場地借用資格。
          </p>
          <button
            onClick={() => openZoneDetail(userPastoralZone || '')}
            className="text-xs font-bold text-danger underline"
          >
            查看詳細違規紀錄 →
          </button>
          <RulesAccordion />
        </div>
      );
    }

    return (
      <div>
        <StatStrip tone="success" icon={Sun} text={`「${userPastoralZone}」借用資格正常`} onClick={() => setShowRules(v => !v)} />
        <div className="flex items-center gap-3 mt-2 px-1">
          <button onClick={() => openZoneDetail(userPastoralZone || '')} className="text-xs font-bold text-primary">
            查看點數明細
          </button>
        </div>
        <RulesAccordion />
      </div>
    );
  };

  return (
    <div className="py-4 space-y-5 animate-fade-in">
      <PullToRefresh onRefresh={async () => { await onRefresh?.(); }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-primary-soft text-primary flex items-center justify-center font-black text-sm">
            {userProfile?.full_name?.substring(0, 2) || user?.email.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-base font-black text-ink leading-tight">
              {userProfile?.full_name || user?.email.split('@')[0]}
            </h2>
            <div className="text-xs text-ink-soft mt-0.5 flex items-center gap-1.5 font-medium">
              <greeting.icon size={13} className="text-accent" />
              <span>{greeting.text}</span>
            </div>
          </div>
        </div>

        {renderStatusStrip()}

        <div className="mt-6">
          <h3 className="text-sm font-black text-ink flex items-center gap-1.5 mb-3">
            <Megaphone size={15} className="text-primary" /> 公告
          </h3>
          {allAnnouncements.length === 0 ? (
            <EmptyState icon={Megaphone} title="目前本據點無任何公告通知" />
          ) : (
            <div className="space-y-2.5">
              {visibleAnnouncements.map((ann) => (
                <ListRow
                  key={ann.id}
                  onClick={() => setSelectedAnn(ann)}
                  icon={<Calendar size={16} />}
                  title={ann.title}
                  subtitle={new Date(ann.created_at).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' })}
                />
              ))}
              {allAnnouncements.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllAnn(v => !v)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs font-bold text-primary"
                >
                  {showAllAnn ? '收起' : `查看全部 ${allAnnouncements.length} 則`}
                  <ChevronDown size={13} className={showAllAnn ? 'rotate-180' : ''} />
                </button>
              )}
            </div>
          )}
        </div>
      </PullToRefresh>

      <Sheet open={!!selectedAnn} onClose={() => setSelectedAnn(null)} title={selectedAnn?.title}>
        {selectedAnn && (
          <>
            <div className="text-xs text-ink-faint mb-4">
              發布日期：{new Date(selectedAnn.created_at).toLocaleString('zh-TW')}
            </div>
            <div className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">{selectedAnn.content}</div>
          </>
        )}
      </Sheet>

      <Sheet
        open={showViolationModal}
        onClose={() => setShowViolationModal(false)}
        title={`${modalPastoralZone} 違規與扣點明細`}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold text-ink-soft shrink-0">查詢月份:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input !min-h-[40px] !py-1.5 text-xs w-auto"
          />
        </div>

        {modalLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
            <p className="text-xs text-ink-faint font-bold">載入中...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-surface-sunken rounded-2xl">
              <div className="text-center">
                <div className="text-[11px] text-ink-soft font-semibold">累計違規</div>
                <div className="text-xl font-black text-ink mt-1">{violationSummary?.totalCount || 0} 次</div>
              </div>
              <div className="text-center border-l border-border">
                <div className="text-[11px] text-ink-soft font-semibold">累計扣點</div>
                <div className={`text-xl font-black mt-1 ${(violationSummary?.totalPoints || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                  {violationSummary?.totalPoints || 0} 點
                </div>
              </div>
            </div>

            {violationSummary?.suspended && (
              <div className="p-3 bg-danger/10 rounded-xl flex items-center gap-2 text-danger text-xs font-bold">
                <AlertOctagon size={14} className="shrink-0" />
                <span>該月已達停權門檻，下個月將被暫停場地預約資格。</span>
              </div>
            )}

            {!violationSummary || !violationSummary.violations || violationSummary.violations.length === 0 ? (
              <EmptyState icon={ClipboardList} title="該月份無任何違規或扣點紀錄" />
            ) : (
              <div className="space-y-2.5">
                {violationSummary.violations.map((v, idx) => {
                  const isCancelled = !!v.is_cancelled;
                  return (
                    <div key={v.id || idx} className={`p-3 rounded-2xl border ${isCancelled ? 'border-border opacity-60' : v.points > 0 ? 'border-danger/25 bg-danger/5' : 'border-warning/25 bg-warning/5'}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${isCancelled ? 'bg-surface-sunken text-ink-faint' : v.points > 0 ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>
                          {isCancelled ? '已撤銷' : `扣 ${v.points} 點`}
                        </span>
                        <span className="text-[11px] font-bold text-ink-soft">{v.booking_date} ({v.start_time}-{v.end_time})</span>
                      </div>
                      <h4 className={`text-xs font-black text-ink ${isCancelled ? 'line-through text-ink-faint font-medium' : ''}`}>{v.reason}</h4>
                      <div className="text-[10px] text-ink-faint mt-1">場地：{v.room_name}（{v.branch}）· 預約人：{v.full_name}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="mt-2">
          <Button variant="secondary" fullWidth onClick={() => setShowViolationModal(false)}>關閉</Button>
        </div>
      </Sheet>
    </div>
  );
}

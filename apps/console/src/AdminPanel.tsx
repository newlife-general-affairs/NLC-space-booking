import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronsLeft, Menu, MoreHorizontal, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@church/shared/auth';
import {
  apiFetchAnnouncements,
  apiFetchAdminIssues,
  apiFetchRooms,
  apiFetchAdminBookings,
  apiFetchPublicSpaces,
  apiFetchViolations,
} from '@church/shared/api';
import type { Announcement, Booking, Issue, PublicSpace, Room, ViolationRecord } from '@church/shared/types';
import { useEscapeKey } from './hooks/useEscapeKey';
import { badgeFor, useConsoleTodos } from './hooks/useConsoleTodos';
import {
  MOBILE_PRIMARY_SECTIONS,
  ROLE_LABEL,
  canAccess,
  findPage,
  getVisibleSections,
  resolveInitialPage,
} from './navigation';
import type { NavSection, PageId } from './navigation';

const OverviewPage = lazy(() => import('./pages/admin/OverviewPage'));
const BookingsTab = lazy(() => import('./pages/admin/BookingsTab'));
const FormIntakeTab = lazy(() => import('./pages/admin/FormIntakeTab'));
const SheetImportPage = lazy(() => import('./pages/admin/SheetImportPage'));
const IssuesTab = lazy(() => import('./pages/admin/IssuesTab'));
const ViolationsTab = lazy(() => import('./pages/admin/ViolationsTab'));
const AnnouncementsTab = lazy(() => import('./pages/admin/AnnouncementsTab'));
const RoomsTab = lazy(() => import('./pages/admin/RoomsTab'));
const PublicSpacesTab = lazy(() => import('./pages/admin/PublicSpacesTab'));
const TuyaTab = lazy(() => import('./pages/admin/TuyaTab'));
const FloorMap = lazy(() => import('./FloorMap'));
const SuperAdminPanel = lazy(() => import('./SuperAdminPanel'));
const WeeklyBulletin = lazy(() => import('@church/shared/components/WeeklyBulletin'));
const SpecialEventsPage = lazy(() => import('@church/shared/components/SpecialEventsPage'));

interface AdminPanelProps {
  currentBranch: string;
  role: string | null;
}

export default function AdminPanel({ currentBranch, role }: AdminPanelProps) {
  const { getToken } = useAuth();
  const isStaff = role === 'admin' || role === 'system_admin';
  const sections = useMemo(() => getVisibleSections(role), [role]);

  const [requestedPage, setRequestedPage] = useState<PageId>(() => resolveInitialPage(role));
  const found = findPage(requestedPage);
  // 角色若沒有這頁的權限（例如網址帶了別的頁面），一律退回總覽
  const page: PageId = found && canAccess(found.page, role) ? requestedPage : 'overview';
  const current = findPage(page)!;

  const [data, setData] = useState<unknown[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => !!current.page.wide);
  const [moreOpen, setMoreOpen] = useState(false);
  useEscapeKey(() => setMoreOpen(false), moreOpen);

  const { bookings, todos, refresh: refreshTodos } = useConsoleTodos(currentBranch, isStaff, getToken);

  const navigate = (next: PageId) => {
    setMoreOpen(false);
    if (next === page) return;
    setData([]);
    setRequestedPage(next);
    setSidebarCollapsed(!!findPage(next)?.page.wide);
    window.history.replaceState(null, '', `#${next}`);
    refreshTodos();
  };

  const loadPageData = useCallback(async (): Promise<unknown[]> => {
    const token = getToken();
    if (!token) return [];
    let fetched: unknown = [];
    switch (page) {
      case 'members-announcements':
        fetched = await apiFetchAnnouncements();
        break;
      case 'onsite-issues':
        fetched = await apiFetchAdminIssues(token, currentBranch);
        break;
      case 'members-violations':
        fetched = await apiFetchViolations(token, currentBranch);
        break;
      case 'settings-rooms':
      case 'settings-devices':
        fetched = await apiFetchRooms(currentBranch);
        break;
      case 'bookings-review':
      case 'onsite-cleaning':
      case 'onsite-locks':
        fetched = await apiFetchAdminBookings(token, currentBranch);
        break;
      case 'settings-public-spaces':
        fetched = await apiFetchPublicSpaces(currentBranch);
        break;
    }
    return Array.isArray(fetched) ? fetched : [];
  }, [page, currentBranch, getToken]);

  useEffect(() => {
    let cancelled = false;
    loadPageData()
      .then(next => { if (!cancelled) setData(next); })
      .catch(err => console.error('Error fetching admin data:', err));
    return () => { cancelled = true; };
  }, [loadPageData]);

  const handleRefresh = useCallback(() => {
    loadPageData()
      .then(setData)
      .catch(err => console.error('Error fetching admin data:', err));
    refreshTodos();
  }, [loadPageData, refreshTodos]);

  const sectionBadge = (section: NavSection) =>
    section.pages.reduce((sum, p) => sum + badgeFor(p.id, todos), 0);

  const mobilePrimary = sections.filter(s => MOBILE_PRIMARY_SECTIONS.includes(s.id));
  const mobileMore = sections.filter(s => !MOBILE_PRIMARY_SECTIONS.includes(s.id));
  const currentSection = sections.find(s => s.id === current.section.id);

  const renderPage = () => {
    switch (page) {
      case 'overview':
        return (
          <OverviewPage
            currentBranch={currentBranch}
            isStaff={isStaff}
            todos={todos}
            bookings={bookings}
            onNavigate={navigate}
            onRefresh={refreshTodos}
          />
        );
      case 'bookings-review':
        return <BookingsTab key="review" tabMode="bookings" data={data as Booking[]} getToken={getToken} onRefresh={handleRefresh} />;
      case 'bookings-form-intake':
        return <FormIntakeTab getToken={getToken} />;
      case 'bookings-sheet-import':
        return <SheetImportPage getToken={getToken} />;
      case 'schedule-week':
        return <WeeklyBulletin currentBranch={currentBranch} isAdmin showSpecialEvents />;
      case 'schedule-events':
        return <SpecialEventsPage currentBranch={currentBranch} hideBack isAdmin />;
      case 'schedule-map':
        return <FloorMap currentBranch={currentBranch} isAdminMode />;
      case 'onsite-cleaning':
        return <BookingsTab key="cleaning" tabMode="cleaning" data={data as Booking[]} getToken={getToken} onRefresh={handleRefresh} />;
      case 'onsite-locks':
        return <BookingsTab key="locks" tabMode="lock-management" data={data as Booking[]} getToken={getToken} onRefresh={handleRefresh} />;
      case 'onsite-issues':
        return <IssuesTab data={data as Issue[]} currentBranch={currentBranch} getToken={getToken} onRefresh={handleRefresh} canManage={isStaff} />;
      case 'members-violations':
        return <ViolationsTab data={data as ViolationRecord[]} getToken={getToken} onRefresh={handleRefresh} currentBranch={currentBranch} />;
      case 'members-announcements':
        return <AnnouncementsTab data={data as Announcement[]} getToken={getToken} onRefresh={handleRefresh} />;
      case 'settings-rooms':
        return <RoomsTab data={data as Room[]} currentBranch={currentBranch} getToken={getToken} onRefresh={handleRefresh} />;
      case 'settings-public-spaces':
        return <PublicSpacesTab data={data as PublicSpace[]} currentBranch={currentBranch} getToken={getToken} onRefresh={handleRefresh} />;
      case 'settings-devices':
        return <TuyaTab data={data as Room[]} currentBranch={currentBranch} getToken={getToken} onRefresh={handleRefresh} />;
      case 'settings-users':
        return <SuperAdminPanel />;
    }
  };

  const badgePill = (count: number, active = false) =>
    count > 0 && (
      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${active ? 'bg-white text-indigo-700' : 'bg-rose-500 text-white'}`}>
        {count}
      </span>
    );

  return (
    <div className="admin-workspace bg-slate-50 flex min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)]">

      {/* ── 桌機：側邊欄 ── */}
      <aside className={`admin-sidebar hidden ${sidebarCollapsed ? '' : 'md:flex'} w-64 shrink-0 flex-col justify-between bg-white border-r border-slate-200 p-4`}>
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-2 px-1">
            <div>
              <div className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <ShieldCheck className="text-indigo-600" size={17} /> 管理主控台
              </div>
              <div className="text-[11px] text-slate-500 font-bold mt-1">{currentBranch}</div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="收合側邊欄"
              aria-label="收合側邊欄"
            >
              <ChevronsLeft size={16} />
            </button>
          </div>

          <nav className="space-y-5" aria-label="管理功能">
            {sections.map(section => (
              <div key={section.id} className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 text-[11px] font-black text-slate-400 tracking-wider">
                  <section.icon size={13} /> {section.label}
                </div>
                {section.pages.map(p => {
                  const active = p.id === page;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(p.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                        active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      <span>{p.label}</span>
                      {badgePill(badgeFor(p.id, todos))}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="pt-4 mt-6 border-t border-slate-200 text-[11px] text-slate-400 font-medium px-1">
          身分：<span className="text-slate-600 font-bold">{ROLE_LABEL[role || ''] || role}</span>
        </div>
      </aside>

      {/* ── 主要內容 ── */}
      <main className="admin-content flex-1 min-w-0 overflow-y-auto p-4 md:p-6 lg:p-8 pb-28 md:pb-8">
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="hidden md:flex mb-4 items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm"
          >
            <Menu size={14} /> 展開選單
          </button>
        )}

        {/* 手機：同一區塊內的頁面切換 */}
        {currentSection && currentSection.pages.length > 1 && (
          <div className="md:hidden -mx-4 px-4 mb-4 flex gap-2 overflow-x-auto scrollbar-hidden">
            {currentSection.pages.map(p => {
              const active = p.id === page;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(p.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap ${
                    active ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {p.label}
                  {badgePill(badgeFor(p.id, todos), active)}
                </button>
              );
            })}
          </div>
        )}

        <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">載入中...</div>}>
          {current.page.wide ? (
            renderPage()
          ) : (
            <div className="md:bg-white md:border md:border-slate-200 md:rounded-2xl md:p-6 lg:p-8">
              {renderPage()}
            </div>
          )}
        </Suspense>
      </main>

      {/* ── 手機：底部導覽 ── */}
      <nav
        aria-label="管理功能"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${mobilePrimary.length + (mobileMore.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {mobilePrimary.map(section => {
            const active = section.id === current.section.id;
            const badge = sectionBadge(section);
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => navigate(active ? page : section.pages[0].id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${active ? 'text-indigo-700' : 'text-slate-500'}`}
              >
                <span className="relative">
                  <section.icon size={20} strokeWidth={active ? 2.5 : 2} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[9px] font-black px-1 rounded-full leading-4">
                      {badge}
                    </span>
                  )}
                </span>
                {section.label}
              </button>
            );
          })}
          {mobileMore.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${
                mobileMore.some(s => s.id === current.section.id) ? 'text-indigo-700' : 'text-slate-500'
              }`}
            >
              <MoreHorizontal size={20} />
              更多
            </button>
          )}
        </div>
      </nav>

      {/* ── 手機：更多選單 ── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMoreOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="更多管理功能" className="relative w-full bg-white rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[80dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-800">更多功能</h3>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="關閉" className="p-2 -m-2 rounded-full text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {mobileMore.map(section => (
                <div key={section.id}>
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 mb-2">
                    <section.icon size={13} /> {section.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {section.pages.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(p.id)}
                        className={`p-3 rounded-xl border text-left text-xs font-bold ${
                          p.id === page ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

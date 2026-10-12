import { lazy, Suspense, useCallback, useState, useEffect } from 'react';
import { useAuth } from '@church/shared/auth';
import { ShieldCheck } from 'lucide-react';
import {
  apiFetchAnnouncements,
  apiFetchAdminIssues,
  apiFetchRooms,
  apiFetchAdminBookings,
  apiFetchPublicSpaces,
  apiFetchViolations,
  apiUpdateBookingStatus,
  apiAssignBookingRoom,
  apiImportRoomsFromSheet,
} from '@church/shared/api';
import type { Announcement, Booking, Issue, PublicSpace, Room, ViolationRecord } from '@church/shared/types';
const AnnouncementsTab = lazy(() => import('./pages/admin/AnnouncementsTab'));
const IssuesTab = lazy(() => import('./pages/admin/IssuesTab'));
const RoomsTab = lazy(() => import('./pages/admin/RoomsTab'));
const PublicSpacesTab = lazy(() => import('./pages/admin/PublicSpacesTab'));
const BookingsTab = lazy(() => import('./pages/admin/BookingsTab'));
const TuyaTab = lazy(() => import('./pages/admin/TuyaTab'));
const ViolationsTab = lazy(() => import('./pages/admin/ViolationsTab'));
const FormIntakeTab = lazy(() => import('./pages/admin/FormIntakeTab'));
const FloorMap = lazy(() => import('./FloorMap'));
const WeeklyBulletin = lazy(() => import('@church/shared/components/WeeklyBulletin'));
const SpecialEventsPage = lazy(() => import('@church/shared/components/SpecialEventsPage'));
const MobileAdminDashboard = lazy(() => import('./components/MobileAdminDashboard'));

interface AdminPanelProps {
  currentBranch: string;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
  adminPendingCount?: number;
  cleaningPendingCount?: number;
  onRefreshPendingCount?: () => void;
}

export default function AdminPanel({
  currentBranch,
  initialTab = 'announcements',
  onTabChange,
  adminPendingCount,
  cleaningPendingCount,
  onRefreshPendingCount,
}: AdminPanelProps) {
  const { role, getToken } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState<unknown[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialTab === 'weekly');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMobileApprove = async (id: number) => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await apiUpdateBookingStatus(token, id, 'approved');
      if (res.ok) {
        fetchActiveTabData();
      } else {
        const err = await res.json();
        alert(err.error || '核可操作失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    }
  };

  const handleMobileReject = async (id: number, reason: string) => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await apiUpdateBookingStatus(token, id, 'rejected', reason);
      if (res.ok) {
        fetchActiveTabData();
      } else {
        const err = await res.json();
        alert(err.error || '拒絕操作失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    }
  };

  const handleMobileAssign = async (bookingId: number, roomName: string) => {
    try {
      const token = getToken();
      if (!token) return;
      const rooms = await apiFetchRooms(currentBranch);
      const matchedRoom = rooms.find((r: Room) => r.name === roomName);
      if (!matchedRoom) {
        alert('找不到該場地空間');
        return;
      }
      const res = await apiAssignBookingRoom(token, bookingId, matchedRoom.id);
      if (res.ok) {
        fetchActiveTabData();
      } else {
        const err = await res.json();
        alert(err.error || '指派失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    }
  };

  const handleMobileImportSheet = async (url: string) => {
    const token = getToken();
    if (!token) return;
    const res = await apiImportRoomsFromSheet(token, url);
    if (res.ok) {
      fetchActiveTabData();
    } else {
      const err = await res.json();
      throw new Error(err.error || '匯入失敗');
    }
  };

  const isInspector = role === 'inspector';

  const handleTabChange = (tab: string) => {
    setData([]);
    setActiveTab(tab);
    if (tab === 'weekly') {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
    if (onTabChange) onTabChange(tab);
  };

  // Sync state if prop changes from outside
  useEffect(() => {
    setData([]);
    setActiveTab(initialTab);
    if (initialTab === 'weekly') {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  }, [initialTab]);

  useEffect(() => {
    if (isInspector && !['cleaning', 'weekly', 'issues'].includes(activeTab)) {
      setActiveTab('cleaning');
    }
  }, [isInspector, activeTab]);

  const sidebarBtn = (tab: string, label: string) => {
    const isActive = activeTab === tab;
    return (
      <button
        key={tab}
        onClick={() => handleTabChange(tab)}
        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group select-none ${
          isActive 
            ? 'bg-indigo-50 text-indigo-600 border-l-4 border-indigo-600 pl-3.5 shadow-sm' 
            : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
        }`}
      >
        <span className="flex items-center gap-1.5">
          {label}
          {tab === 'bookings' && adminPendingCount !== undefined && adminPendingCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
              {adminPendingCount}
            </span>
          )}
          {tab === 'cleaning' && cleaningPendingCount !== undefined && cleaningPendingCount > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
              {cleaningPendingCount}
            </span>
          )}
        </span>
        {isActive && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />}
      </button>
    );
  };

  const fetchActiveTabData = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;

      let fetchedData: unknown[] = [];
      if (activeTab === 'announcements') {
        fetchedData = await apiFetchAnnouncements();
      } else if (activeTab === 'issues') {
        fetchedData = await apiFetchAdminIssues(token, currentBranch);
      } else if (activeTab === 'violations') {
        fetchedData = await apiFetchViolations(token, currentBranch);
      } else if (activeTab === 'rooms') {
        fetchedData = await apiFetchRooms(currentBranch);
      } else if (activeTab === 'bookings' || activeTab === 'cleaning' || activeTab === 'lock-management') {
        fetchedData = await apiFetchAdminBookings(token, currentBranch);
      } else if (activeTab === 'public_spaces') {
        fetchedData = await apiFetchPublicSpaces(currentBranch);
      } else if (activeTab === 'tuya') {
        fetchedData = await apiFetchRooms(currentBranch);
      }
      setData(Array.isArray(fetchedData) ? fetchedData : []);
      onRefreshPendingCount?.();
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  }, [activeTab, currentBranch, getToken, onRefreshPendingCount]);

  useEffect(() => {
    fetchActiveTabData();
  }, [fetchActiveTabData]);

  const allMobileTabs = [
    { id: 'bookings', label: '📋 預約審核' },
    { id: 'form-intake', label: '📥 表單匯入' },
    { id: 'lock-management', label: '🔑 門鎖管理' },
    { id: 'special-events', label: '💒 婚禮重要' },
    { id: 'cleaning', label: '🧹 清潔稽核' },
    { id: 'issues',   label: '⚠️ 故障回報' },
    { id: 'violations', label: '🚨 違規紀錄' },
    { id: 'weekly',     label: '📅 借用概況' },
    { id: 'map',        label: '🗺️ 即時地圖' },
    { id: 'announcements', label: '📣 公告管理' },
    { id: 'rooms',    label: '🔑 場地配置' },
    { id: 'public_spaces', label: '🧹 公共空間' },
    { id: 'tuya',    label: '🔌 智慧裝置' },
  ];

  const allowedMobileTabs = allMobileTabs.filter(tab => {
    if (isInspector) {
      return ['cleaning', 'weekly', 'issues'].includes(tab.id);
    }
    return true;
  });

  if (isMobile) {
    return (
      <Suspense fallback={<div className="py-12 text-center text-xs text-neutral-400">載入中...</div>}>
        <MobileAdminDashboard
          currentBranch={currentBranch}
          initialBookings={data as Booking[]}
          onApprove={handleMobileApprove}
          onReject={handleMobileReject}
          onAssignRoom={handleMobileAssign}
          onImportSheet={handleMobileImportSheet}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          allowedTabs={allowedMobileTabs}
          pendingCount={adminPendingCount}
        >
          {activeTab === 'issues' && (
            <IssuesTab
              data={data as Issue[]}
              getToken={getToken}
              onRefresh={fetchActiveTabData}
            />
          )}
          {activeTab === 'form-intake' && (
            <FormIntakeTab getToken={getToken} />
          )}
          {activeTab === 'map' && (
            <FloorMap
              currentBranch={currentBranch}
              isAdminMode={true}
            />
          )}
          {activeTab === 'special-events' && (
            <SpecialEventsPage
              currentBranch={currentBranch}
              onBack={() => handleTabChange('bookings')}
              hideBack={true}
              isAdmin={true}
            />
          )}
          {activeTab === 'weekly' && (
            <WeeklyBulletin
              currentBranch={currentBranch}
              isAdmin={!isInspector}
            />
          )}
          {activeTab === 'cleaning' && (
            <BookingsTab
              tabMode="cleaning"
              data={data as Booking[]}
              getToken={getToken}
              onRefresh={fetchActiveTabData}
            />
          )}
          {activeTab === 'announcements' && (
            <AnnouncementsTab
              data={data as Announcement[]}
              getToken={getToken}
              onRefresh={fetchActiveTabData}
            />
          )}
          {activeTab === 'violations' && (
            <ViolationsTab
              data={data as ViolationRecord[]}
              getToken={getToken}
              onRefresh={fetchActiveTabData}
              currentBranch={currentBranch}
            />
          )}
          {activeTab === 'rooms' && (
            <RoomsTab
              data={data as Room[]}
              currentBranch={currentBranch}
              getToken={getToken}
              onRefresh={fetchActiveTabData}
            />
          )}
          {activeTab === 'public_spaces' && (
            <PublicSpacesTab
              data={data as PublicSpace[]}
              currentBranch={currentBranch}
              getToken={getToken}
              onRefresh={fetchActiveTabData}
            />
          )}
          {activeTab === 'tuya' && (
            <TuyaTab
              data={data as Room[]}
              currentBranch={currentBranch}
              getToken={getToken}
              onRefresh={fetchActiveTabData}
            />
          )}
        </MobileAdminDashboard>
      </Suspense>
    );
  }

  return (
    <div className="admin-workspace bg-slate-100 flex flex-col md:flex-row min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-4rem)] animate-in fade-in duration-300">

      {/* ── Mobile: Horizontal scrollable pill tabs ── */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-4 pb-3 space-y-3">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-indigo-600" /> 同工管理主控台 · {currentBranch}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {allowedMobileTabs.map(({ id, label }) => {
            const hasBadge = (id === 'bookings' && adminPendingCount !== undefined && adminPendingCount > 0) ||
                             (id === 'cleaning' && cleaningPendingCount !== undefined && cleaningPendingCount > 0);
            const badgeCount = id === 'bookings' ? adminPendingCount : cleaningPendingCount;
            return (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap flex items-center gap-1 ${
                  activeTab === id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-150'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{label}</span>
                {hasBadge && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    activeTab === id ? 'bg-white text-indigo-600' : 'bg-rose-500 text-white'
                  }`}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Desktop: Grouped Sidebar ── */}
      <aside className={`transition-all duration-300 shrink-0 flex-col justify-between admin-sidebar bg-white border-r border-slate-200 p-5 ${isSidebarCollapsed ? 'hidden' : 'hidden md:flex w-72'}`}>
        <div className="space-y-8">

          {/* Dashboard Title */}
          <div className="space-y-1.5 flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <ShieldCheck className="text-indigo-600" size={20} /> 同工管理主控台
              </h3>
              <div className="inline-block bg-indigo-50 text-indigo-600 border border-indigo-200/60 text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded">
                {currentBranch} 據點營運
              </div>
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1.5 rounded-xl transition-all duration-200 flex items-center justify-center shrink-0"
              title="收合側邊欄"
            >
              ◀
            </button>
          </div>

          {/* Navigation Groups */}
          <nav className="space-y-6">

            {/* Operations Group 1: 預約與營運管理 */}
            <div className="space-y-1.5">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-1.5">
                預約與營運
              </div>
              <div className="space-y-1">
                {!isInspector && sidebarBtn('bookings', '預約申請審核')}
                {!isInspector && sidebarBtn('form-intake', '表單匯入紀錄')}
                {!isInspector && sidebarBtn('lock-management', '門鎖密碼管理')}
                {!isInspector && sidebarBtn('special-events', '婚禮與重要活動')}
                {sidebarBtn('cleaning', '打掃與清潔稽核')}
                {sidebarBtn('weekly', '場地借用概況')}
                {!isInspector && sidebarBtn('map', '即時平面地圖')}
              </div>
            </div>

            {/* Operations Group 2: 異常回報、違規與公告 */}
            <div className="space-y-1.5">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-1.5">
                事件與溝通
              </div>
              <div className="space-y-1">
                {sidebarBtn('issues', '故障回報處理')}
                {!isInspector && sidebarBtn('violations', '違規紀錄名單')}
                {!isInspector && sidebarBtn('announcements', '據點公告管理')}
              </div>
            </div>

            {/* Resources Group */}
            {!isInspector && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-1.5">
                  空間與配置
                </div>
                <div className="space-y-1">
                  {sidebarBtn('rooms', '場地空間配置')}
                  {sidebarBtn('public_spaces', '公共空間規劃')}
                </div>
              </div>
            )}

            {/* IoT Group */}
            {!isInspector && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-1.5">
                  聯網硬體
                </div>
                <div className="space-y-1">
                  {sidebarBtn('tuya', '智慧裝置連線')}
                </div>
              </div>
            )}

          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-slate-200/80 text-[10px] text-slate-400 font-medium">
          <div>教會場地預約 Lite v2.5</div>
          <div className="mt-1">身分：<span className="text-slate-600 font-bold">{role}</span></div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="admin-content flex-1 bg-slate-50/70 p-4 md:p-6 lg:p-8 min-w-0 overflow-y-auto">
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="mb-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 select-none hover:scale-105 active:scale-95 duration-200"
          >
            ☰ 展開主控台選單
          </button>
        )}
        <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">載入中...</div>}>
        {activeTab === 'weekly' && (
          <WeeklyBulletin
            currentBranch={currentBranch}
            isAdmin={!isInspector}
          />
        )}
        {activeTab === 'special-events' && (
          <SpecialEventsPage
            currentBranch={currentBranch}
            onBack={() => handleTabChange('bookings')}
            hideBack={true}
            isAdmin={true}
          />
        )}
        {!isInspector && activeTab === 'map' && (
          <FloorMap
            currentBranch={currentBranch}
            isAdminMode={true}
          />
        )}
        {activeTab !== 'weekly' && activeTab !== 'map' && (
          <div className="bg-white p-4 md:p-6 lg:p-8 min-h-full">
            {!isInspector && activeTab === 'announcements' && (
              <AnnouncementsTab
                data={data as Announcement[]}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
              />
            )}
            {activeTab === 'issues' && (
              <IssuesTab
                data={data as Issue[]}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
              />
            )}
            {!isInspector && activeTab === 'violations' && (
              <ViolationsTab
                data={data as ViolationRecord[]}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
                currentBranch={currentBranch}
              />
            )}
            {!isInspector && activeTab === 'rooms' && (
              <RoomsTab
                data={data as Room[]}
                currentBranch={currentBranch}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
              />
            )}
            {!isInspector && activeTab === 'public_spaces' && (
              <PublicSpacesTab
                data={data as PublicSpace[]}
                currentBranch={currentBranch}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
              />
            )}
            {!isInspector && activeTab === 'bookings' && (
              <BookingsTab
                tabMode="bookings"
                data={data as Booking[]}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
              />
            )}
            {!isInspector && activeTab === 'form-intake' && (
              <FormIntakeTab getToken={getToken} />
            )}
            {!isInspector && activeTab === 'lock-management' && (
              <BookingsTab
                tabMode="lock-management"
                data={data as Booking[]}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
              />
            )}
            {activeTab === 'cleaning' && (
              <BookingsTab
                tabMode="cleaning"
                data={data as Booking[]}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
              />
            )}
            {!isInspector && activeTab === 'tuya' && (
              <TuyaTab
                data={data as Room[]}
                currentBranch={currentBranch}
                getToken={getToken}
                onRefresh={fetchActiveTabData}
              />
            )}
          </div>
        )}
        </Suspense>
      </main>
    </div>
  );
}

import { lazy, Suspense, useCallback, useState, useEffect } from 'react';
import { MapPin, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '@church/shared/auth';
import Login from '@church/shared/components/Login';
import { BRANCHES } from '@church/shared/constants';
import { apiFetchAdminBookings } from '@church/shared/api';
import { isBookingPast } from '@church/shared/domain/roomGrid';
import type { ActiveTab } from '@church/shared/types';

import AppHeader from './components/AppHeader';
import ProfileModal from './components/ProfileModal';
import { useProfile } from './hooks/useProfile';

const AdminPanel = lazy(() => import('./AdminPanel'));
const SuperAdminPanel = lazy(() => import('./SuperAdminPanel'));

type ConsoleView = 'branches' | 'system' | 'admin';

export default function App() {
  const { user, role, loading, accountError, retryAccountLoad, signOut, getToken, branch } = useAuth();

  const [view, setView] = useState<ConsoleView>('branches');
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [adminSubTab, setAdminSubTab] = useState<string>('announcements');
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const [cleaningPendingCount, setCleaningPendingCount] = useState(0);

  const isAdmin =
    role === 'system_admin' ||
    role === 'inspector' ||
    (role === 'admin' && (branch === '全' || (currentBranch !== null && branch === currentBranch)));

  const fetchAdminPendingCount = useCallback(() => {
    if (!isAdmin || !currentBranch) {
      setAdminPendingCount(0);
      setCleaningPendingCount(0);
      return;
    }
    apiFetchAdminBookings(getToken(), currentBranch)
      .then(data => {
        if (!Array.isArray(data)) return;

        let bookingsCount = 0;
        let cleaningCount = 0;

        data.forEach(b => {
          if (b.status === 'pending') {
            // 只算「還沒過期」的待審核，與後台「預約申請審核」分頁的清單一致
            if (!isBookingPast(b.booking_date, b.end_time)) {
              bookingsCount += 1;
            }
          } else if (b.status === 'approved' && !b.is_returned) {
            const rawAssignments = b.cleaning_assignments || '';
            const parts = rawAssignments.split('::');
            const assignState = parts[1] || '';
            const isSubmitted = assignState === 'submitted' || assignState === 'resubmitted';
            const isRejected = assignState === 'rejected';

            // Check if overdue (1 hour buffer)
            let overdue = false;
            try {
              const endPart = b.end_time.substring(0, 5); // "HH:MM"
              const [parsedHours, minutes] = endPart.split(':').map(Number);
              let hours = parsedHours;
              hours += 1;
              let targetDateStr = b.booking_date;
              if (hours >= 24) {
                hours -= 24;
                const nextDay = new Date(b.booking_date);
                nextDay.setDate(nextDay.getDate() + 1);
                targetDateStr = nextDay.toISOString().split('T')[0];
              }
              const overdueTime = new Date(`${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
              overdue = new Date() > overdueTime;
            } catch { /* Ignore malformed legacy booking times. */ }

            if (!overdue && (isSubmitted || isRejected)) {
              cleaningCount += 1;
            }
          }
        });

        setAdminPendingCount(bookingsCount);
        setCleaningPendingCount(cleaningCount);
      })
      .catch(console.error);
  }, [currentBranch, getToken, isAdmin]);

  useEffect(() => {
    fetchAdminPendingCount();
  }, [view, adminSubTab, fetchAdminPendingCount]);

  useEffect(() => {
    if (role === 'inspector' && (adminSubTab === 'announcements' || adminSubTab === 'violations')) {
      setAdminSubTab('cleaning');
    }
  }, [role, adminSubTab]);

  const profileHook = useProfile({ getToken });

  // Auto lock regular admin / inspector to their assigned branch on reload/mount
  useEffect(() => {
    if (user && (role === 'admin' || role === 'inspector') && branch && branch !== '全') {
      setCurrentBranch(branch);
      setView('admin');
    }
  }, [user, role, branch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <span className="text-sm text-slate-300 font-medium">載入中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (accountError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-3xl border border-rose-400/40 bg-surface-raised p-8 text-center shadow-modal">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-xl text-rose-400">
            !
          </div>
          <h1 className="text-lg font-bold text-white">使用者資料載入失敗</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{accountError}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void retryAccountLoad()}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500"
            >
              重新讀取
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/5"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non-admin accounts have no place in the console.
  if (role === 'user') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-300/20 bg-surface-raised p-8 text-center shadow-modal">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
            <ShieldAlert size={22} />
          </div>
          <h1 className="text-lg font-bold text-white">此帳號沒有後台權限</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            這裡是同工管理後台。若您要預約場地，請前往場地預約系統。
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-6 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/5"
          >
            登出
          </button>
        </div>
      </div>
    );
  }

  const headerTab: ActiveTab = view === 'admin' ? 'admin' : view === 'system' ? 'system' : 'branches';

  return (
    <div className="min-h-screen font-sans bg-surface text-slate-100 animate-fade-in pb-12">
      <AppHeader
        user={user}
        role={role}
        currentBranch={currentBranch}
        activeTab={headerTab}
        isAdmin={isAdmin}
        onLogoClick={() => {
          setCurrentBranch(null);
          setView('branches');
        }}
        onSwitchBranch={() => {
          setCurrentBranch(null);
          setView('branches');
        }}
        onTabChange={(tab) => {
          if (tab === 'system') {
            setCurrentBranch(null);
            setView('system');
          }
        }}
        onOpenProfile={profileHook.openProfile}
        onSignOut={signOut}
      />

      <main className={view === 'admin' ? 'w-full' : 'mx-auto mt-0 md:mt-6 max-w-[1400px] px-0 sm:px-4'}>
        <Suspense fallback={<div className="py-16 text-center text-sm text-white/50">載入中...</div>}>
          {view === 'system' && role === 'system_admin' && <SuperAdminPanel />}

          {view !== 'system' && !currentBranch && (
            <div className="max-w-3xl mx-auto py-12 px-4">
              <div className="text-center mb-10 animate-fade-up">
                <p className="section-label mb-3">選擇據點</p>
                <h1 className="text-2xl font-bold text-white/90 tracking-tight">請選擇要管理的據點</h1>
                <p className="text-sm text-white/40 mt-2">進入後可處理該據點的預約審核、清潔稽核與場地配置</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BRANCHES.map((b, idx) => (
                  <button
                    key={b}
                    onClick={() => {
                      setCurrentBranch(b);
                      setView('admin');
                    }}
                    className="group card card-hover card-brand p-5 text-left flex flex-col gap-3 animate-fade-up"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600/12 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-600/25 transition-colors">
                      <MapPin size={16} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">{b}</div>
                      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-white/25 group-hover:text-indigo-400 transition-colors">
                        進入管理 <ArrowRight size={10} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === 'admin' && currentBranch && isAdmin && (
            <AdminPanel
              currentBranch={currentBranch}
              initialTab={adminSubTab}
              onTabChange={setAdminSubTab}
              adminPendingCount={adminPendingCount}
              cleaningPendingCount={cleaningPendingCount}
              onRefreshPendingCount={fetchAdminPendingCount}
            />
          )}
        </Suspense>
      </main>

      {profileHook.profileModalOpen && (
        <ProfileModal
          user={user}
          role={role}
          profileForm={profileHook.profileForm}
          profileSaveStatus={profileHook.profileSaveStatus}
          onChange={profileHook.setProfileForm}
          onSave={profileHook.saveProfile}
          onClose={() => profileHook.setProfileModalOpen(false)}
          isForceFill={false}
        />
      )}
    </div>
  );
}

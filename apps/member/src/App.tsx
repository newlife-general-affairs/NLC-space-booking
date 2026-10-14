import { lazy, Suspense, useCallback, useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { CalendarDays, CalendarPlus, Home, UserRound } from 'lucide-react';
import { useAuth } from '@church/shared/auth';

import AppHeader from './components/AppHeader';
import StatusToast from './components/StatusToast';
import ProfileModal from './components/ProfileModal';
import CleanupModal from './components/CleanupModal';
import { BottomNav, Button } from './ui';
import { InstallBanner } from './features/pwa/InstallBanner';
import { useAppUpdate } from './features/pwa/useAppUpdate';

import LoginPage from './pages/LoginPage';
import BookingPage from './pages/BookingPage';
import HomePage from './pages/HomePage';
import BranchPickerPage from './pages/BranchPickerPage';
import { parseTabParam, type MemberTab } from './navigation';

import { useBooking } from './hooks/useBooking';
import { useIssueReport } from './hooks/useIssueReport';
import { useProfile } from './hooks/useProfile';

import {
  apiFetchProfile,
  apiFetchAnnouncements,
  apiFetchRooms,
  apiFetchBookings,
  apiFetchDisqualifiedZones,
} from '@church/shared/api';

import type { Room, Booking, Announcement, UserProfile, DisqualifiedZone } from '@church/shared/types';
const WeeklyBulletin = lazy(() => import('@church/shared/components/WeeklyBulletin'));
const MePage = lazy(() => import('./pages/MePage'));
const IssueReportPage = lazy(() => import('./pages/IssueReportPage'));

export default function App() {
  const { user, role, loading, accountError, retryAccountLoad, signOut, getToken, branch } = useAuth();

  const [activeTab, setActiveTab] = useState<MemberTab>(() =>
    parseTabParam(new URLSearchParams(window.location.search).get('tab'))
  );
  const [currentBranch, setCurrentBranchState] = useState<string | null>(() => localStorage.getItem('member:selectedBranch'));

  const setCurrentBranch = useCallback((branch: string | null) => {
    setCurrentBranchState(branch);
    if (branch) localStorage.setItem('member:selectedBranch', branch);
    else localStorage.removeItem('member:selectedBranch');
  }, []);

  // Clean up the ?tab=/?source= shortcut query params once read, without adding a history entry.
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [cleanupBooking, setCleanupBooking] = useState<Booking | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [disqualifiedZones, setDisqualifiedZones] = useState<DisqualifiedZone[]>([]);

  const isAdmin =
    role === 'system_admin' ||
    role === 'inspector' ||
    (role === 'admin' && (branch === '全' || (currentBranch !== null && branch === currentBranch)));

  const bookingHook = useBooking({
    rooms,
    currentBranch,
    isAdmin,
    userEmail: user?.email,
    getToken,
    onSuccess: (tab) => {
      setActiveTab(tab);
      fetchBookings();
    },
    onProfileAutoSaved: (formData) => {
      setUserProfile({
        full_name: formData.fullName,
        phone: formData.phone,
        pastoral_zone: formData.pastoralZone,
      });
    },
  });

  const profileHook = useProfile({
    getToken,
    onSaved: (formData) => {
      setUserProfile({
        full_name: formData.fullName,
        phone: formData.phone,
        pastoral_zone: formData.pastoralZone,
      });
      bookingHook.prefillProfile({
        full_name: formData.fullName,
        phone: formData.phone,
        pastoral_zone: formData.pastoralZone,
      });
    },
  });

  const issueReportHook = useIssueReport({
    getToken,
    onSuccess: () => {},
  });

  const { updateAvailable, applyUpdate } = useAppUpdate();

  // Auto lock regular admin to their assigned branch on reload/mount
  useEffect(() => {
    if (user && (role === 'admin' || role === 'inspector') && branch && branch !== '全') {
      setCurrentBranch(branch);
    }
  }, [user, role, branch, setCurrentBranch]);

  // Load profile on start/login to prefill booking form
  useEffect(() => {
    if (!user) return;
    apiFetchProfile(getToken())
      .then(profile => {
        if (profile) {
          setUserProfile(profile);
          bookingHook.prefillProfile(profile);

          // 第一次登入/無基本資料：僅依據常用姓名是否未填來判定
          const isFirstLogin = !profile.full_name || !profile.full_name.trim();
          if (isFirstLogin) {
            profileHook.setProfileForm({
              fullName: profile.full_name || '',
              phone: profile.phone || '',
              pastoralZone: profile.pastoral_zone || '',
            });
            profileHook.setProfileModalOpen(true);
          }
        } else {
          profileHook.setProfileForm({ fullName: '', phone: '', pastoralZone: '' });
          profileHook.setProfileModalOpen(true);
        }
      })
      .catch(console.error);
    // Hook actions are intentionally sampled only when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch disqualified pastoral zones
  const fetchDisqualifiedZones = useCallback(() => {
    if (!user) return Promise.resolve();
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).substring(0, 7);
    return apiFetchDisqualifiedZones(getToken(), dateStr, currentBranch)
      .then(data => {
        if (Array.isArray(data)) {
          setDisqualifiedZones(data);
        }
      })
      .catch(console.error);
  }, [user, currentBranch, getToken]);

  useEffect(() => {
    // Profile changes intentionally trigger a fresh suspension lookup.
    fetchDisqualifiedZones();
  }, [fetchDisqualifiedZones, userProfile]);

  // Fetch announcements
  const fetchAnnouncements = useCallback(() => {
    if (!user) return Promise.resolve();
    return apiFetchAnnouncements()
      .then(data => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const refreshHome = useCallback(async () => {
    await Promise.all([fetchAnnouncements(), fetchDisqualifiedZones()]);
  }, [fetchAnnouncements, fetchDisqualifiedZones]);

  // Fetch rooms when branch changes
  useEffect(() => {
    if (!currentBranch) return;
    apiFetchRooms(currentBranch)
      .then(data => setRooms(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [user, currentBranch]);

  // Fetch bookings when the me (records), issues or booking tab is active
  const fetchBookings = useCallback(() => {
    setBookings([]);
    if (!currentBranch) return;
    apiFetchBookings(getToken(), currentBranch)
      .then(data => setBookings(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [currentBranch, getToken]);

  useEffect(() => {
    if (activeTab === 'me' || activeTab === 'issues' || activeTab === 'booking') {
      fetchBookings();
    }
  }, [activeTab, fetchBookings]);

  useEffect(() => {
    bookingHook.setBookingStarted(false);
    bookingHook.setBookingStep(1);
    // Booking workflow reset is scoped to branch changes; hook container identity is irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranch]);

  useEffect(() => {
    if (activeTab === 'issues' && !issueReportHook.reportingBooking) {
      setActiveTab('me');
    }
  }, [activeTab, issueReportHook.reportingBooking]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
          <span className="text-sm text-ink-soft font-medium">載入中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (accountError) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm rounded-3xl border border-danger/25 bg-surface p-8 text-center shadow-modal">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-xl text-danger">
            !
          </div>
          <h1 className="text-lg font-black text-ink">使用者資料載入失敗</h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">{accountError}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="primary" fullWidth onClick={() => void retryAccountLoad()}>重新讀取</Button>
            <Button variant="ghost" fullWidth onClick={() => void signOut()}>登出</Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`min-h-dvh font-sans bg-bg text-ink animate-fade-in ${currentBranch ? 'pb-24' : 'pb-6'}`}>
      <AppHeader currentBranch={currentBranch} onSignOut={signOut} />

      <main className="mx-auto max-w-lg px-4">
        <StatusToast
          statusMsg={bookingHook.statusMsg}
          onDismiss={() => bookingHook.setStatusMsg({ type: '', text: '' })}
        />

        {!currentBranch ? (
          <BranchPickerPage
            onSelectBranch={(b) => {
              setCurrentBranch(b);
              setActiveTab('home');
            }}
          />
        ) : (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[var(--ink-soft)]">載入中...</div>}>
        {activeTab === 'home' && (
          <>
            <div className="pt-4"><InstallBanner /></div>
            <HomePage
              user={user as User & { email: string }}
              userProfile={userProfile}
              announcements={announcements}
              disqualifiedZones={disqualifiedZones}
              isAdmin={isAdmin}
              getToken={getToken}
              onRefresh={refreshHome}
            />
          </>
        )}

        {activeTab === 'booking' && (
          <BookingPage
            getToken={getToken}
            currentBranch={currentBranch}
            isAdmin={isAdmin}
            rooms={rooms}
            userBookings={bookings}
            bookingStarted={bookingHook.bookingStarted}
            bookingStep={bookingHook.bookingStep}
            bookingState={bookingHook.bookingState}
            bookingSubmitting={bookingHook.bookingSubmitting}
            selectedRooms={bookingHook.selectedRooms}
            roomPurposes={bookingHook.roomPurposes}
            roomAvailability={bookingHook.roomAvailability}
            onStart={() => bookingHook.setBookingStarted(true)}
            onStepChange={bookingHook.setBookingStep}
            onBookingStateChange={bookingHook.setBookingState}
            onSelectRooms={bookingHook.setSelectedRooms}
            onRoomPurposesChange={bookingHook.setRoomPurposes}
            onConfirm={bookingHook.handleBooking}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'weekly' && (
          <div className="pt-4">
            <WeeklyBulletin
              currentBranch={currentBranch}
              isAdmin={false}
              showSpecialEvents
              onStartBooking={(date, roomId) => {
                bookingHook.startBookingFromCalendar(date, roomId);
                setActiveTab('booking');
              }}
            />
          </div>
        )}

        {activeTab === 'me' && (
          <MePage
            email={user.email || ''}
            userProfile={userProfile}
            currentBranch={currentBranch}
            bookings={bookings}
            onOpenProfile={profileHook.openProfile}
            onSwitchBranch={() => {
              setCurrentBranch(null);
              setActiveTab('home');
            }}
            onSignOut={signOut}
            onStartCleanup={setCleanupBooking}
            onReportIssue={(booking) => {
              issueReportHook.startReporting(booking);
              setActiveTab('issues');
            }}
          />
        )}

        {activeTab === 'issues' && issueReportHook.reportingBooking && (
          <IssueReportPage
            currentBranch={currentBranch}
            selectableItems={issueReportHook.getSelectableItems()}
            selectedTarget={issueReportHook.selectedIssueTarget}
            description={issueReportHook.issueDescription}
            submitting={issueReportHook.issueSubmitting}
            statusMsg={issueReportHook.issueStatusMsg}
            onTargetChange={issueReportHook.setSelectedIssueTarget}
            onDescriptionChange={issueReportHook.setIssueDescription}
            onSubmit={issueReportHook.submitIssue}
            onContinue={issueReportHook.resetReport}
            onBack={() => {
              setActiveTab('me');
              issueReportHook.setReportingBooking(null);
            }}
            backLabel="我的"
          />
        )}
        </Suspense>
        )}
      </main>

      {updateAvailable && (
        <div className={`fixed left-4 right-4 z-40 flex items-center justify-between gap-3 px-4 py-3 bg-ink text-white rounded-2xl shadow-modal ${currentBranch ? 'bottom-24' : 'bottom-4'}`}>
          <span className="text-xs font-bold">有新版本可以更新</span>
          <Button variant="primary" onClick={applyUpdate} className="!min-h-[32px] !px-3 text-xs shrink-0">立即更新</Button>
        </div>
      )}

      {currentBranch && (
        <BottomNav
          active={activeTab === 'issues' ? 'me' : activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'home', label: '首頁', icon: Home },
            { id: 'booking', label: '預約', icon: CalendarPlus },
            { id: 'weekly', label: '檔期', icon: CalendarDays },
            { id: 'me', label: '我的', icon: UserRound },
          ]}
        />
      )}
      {profileHook.profileModalOpen && (
        <ProfileModal
          user={user}
          role={role}
          profileForm={profileHook.profileForm}
          profileSaveStatus={profileHook.profileSaveStatus}
          onChange={profileHook.setProfileForm}
          onSave={profileHook.saveProfile}
          onClose={() => profileHook.setProfileModalOpen(false)}
          isForceFill={!userProfile?.full_name || !userProfile?.full_name.trim()}
        />
      )}

      {cleanupBooking && (
        <CleanupModal
          booking={cleanupBooking}
          getToken={getToken}
          onSuccess={(msg) => bookingHook.setStatusMsg({ type: 'success', text: msg })}
          onClose={() => setCleanupBooking(null)}
          onRefresh={fetchBookings}
        />
      )}
    </div>
  );
}

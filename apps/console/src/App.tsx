import { lazy, Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { MapPin, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '@church/shared/auth';
import Login from '@church/shared/components/Login';
import { BRANCHES } from '@church/shared/constants';
import AppHeader from './components/AppHeader';
import ProfileModal from './components/ProfileModal';
import { useProfile } from './hooks/useProfile';

const AdminPanel = lazy(() => import('./AdminPanel'));

function CenteredCard({ tone = 'slate', children }: { tone?: 'slate' | 'rose'; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className={`w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-lg ${tone === 'rose' ? 'border-rose-200' : 'border-slate-200'}`}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const { user, role, loading, accountError, retryAccountLoad, signOut, getToken, branch } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const profileHook = useProfile({ getToken });

  // 指派到單一據點的管理員／查察員固定在自己的據點，不能切換
  const lockedBranch = (role === 'admin' || role === 'inspector') && branch && branch !== '全' ? branch : null;
  const currentBranch = lockedBranch ?? selectedBranch;
  const hasBranchAccess =
    role === 'system_admin' ||
    role === 'inspector' ||
    (role === 'admin' && (branch === '全' || (currentBranch !== null && branch === currentBranch)));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-600 animate-spin" />
          <span className="text-sm text-slate-500 font-medium">載入中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (accountError) {
    return (
      <CenteredCard tone="rose">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-xl text-rose-600">
          !
        </div>
        <h1 className="text-lg font-bold text-slate-800">使用者資料載入失敗</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{accountError}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void retryAccountLoad()}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            重新讀取
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            登出
          </button>
        </div>
      </CenteredCard>
    );
  }

  // Non-admin accounts have no place in the console.
  if (role === 'user') {
    return (
      <CenteredCard>
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <ShieldAlert size={22} />
        </div>
        <h1 className="text-lg font-bold text-slate-800">此帳號沒有後台權限</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          這裡是同工管理後台。若您要預約場地，請前往場地預約系統。
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        >
          登出
        </button>
      </CenteredCard>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-slate-100 text-slate-800 animate-fade-in">
      <AppHeader
        user={user}
        role={role}
        currentBranch={currentBranch}
        onSwitchBranch={lockedBranch ? undefined : () => setSelectedBranch(null)}
        onOpenProfile={profileHook.openProfile}
        onSignOut={signOut}
      />

      {!currentBranch ? (
        <div className="max-w-3xl mx-auto py-12 px-4">
          <div className="text-center mb-10 animate-fade-up">
            <p className="text-xs font-bold text-slate-500 tracking-widest mb-3">選擇據點</p>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">請選擇要管理的據點</h1>
            <p className="text-sm text-slate-500 mt-2">進入後可處理該據點的預約審核、清潔稽核與場地配置</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BRANCHES.map((b, idx) => (
              <button
                key={b}
                onClick={() => setSelectedBranch(b)}
                className="group bg-white border border-slate-200 rounded-2xl p-5 text-left flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all animate-fade-up"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600">
                  <MapPin size={16} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{b}</div>
                  <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-500 group-hover:text-indigo-600 transition-colors">
                    進入管理 <ArrowRight size={10} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : hasBranchAccess ? (
        <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">載入中...</div>}>
          <AdminPanel key={currentBranch} currentBranch={currentBranch} role={role} />
        </Suspense>
      ) : (
        <div className="max-w-md mx-auto py-16 px-4 text-center">
          <h1 className="text-lg font-bold text-slate-800">沒有「{currentBranch}」的管理權限</h1>
          <p className="mt-2 text-sm text-slate-500">請選擇您被指派的據點，或請系統管理員調整權限。</p>
          <button
            type="button"
            onClick={() => setSelectedBranch(null)}
            className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            返回選擇據點
          </button>
        </div>
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
          isForceFill={false}
        />
      )}
    </div>
  );
}

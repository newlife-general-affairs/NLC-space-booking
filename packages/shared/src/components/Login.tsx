import { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { useAuth } from '../auth';

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;

    setIsSigningIn(true);
    setLoginError('');
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setLoginError('Google 登入啟動失敗，請稍後再試。');
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden px-4 py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-400/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-slate-400/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-400/5 rounded-full blur-[100px]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        <div className="bg-surface-raised/90 backdrop-blur-2xl border border-slate-300/20 rounded-3xl p-6 sm:p-8 shadow-modal">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/25 text-indigo-400 mb-5 shadow-glow-sm">
              <Building2 size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mb-2">教會場地借用系統</h1>
            <p className="text-sm text-slate-300 leading-relaxed">請登入以進行空間預約與管理</p>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-surface-raised text-slate-300 font-medium">繼續使用</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            aria-busy={isSigningIn}
            className="group w-full min-h-[52px] flex items-center justify-center gap-3 bg-indigo-400 hover:bg-indigo-300 border border-indigo-300 text-surface font-bold py-3.5 px-5 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-card hover:shadow-glow disabled:cursor-wait disabled:opacity-60"
          >
            {isSigningIn ? (
              <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <svg width="18" height="18" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            <span className="whitespace-nowrap text-sm">
              {isSigningIn ? '正在前往 Google…' : '使用 Google 帳號登入'}
            </span>
          </button>

          {loginError && (
            <p role="alert" className="mt-4 text-center text-xs text-rose-400">{loginError}</p>
          )}

          <p className="mt-6 text-center text-xs text-slate-300 leading-relaxed">
            登入即表示您同意本系統的使用規範。<br />
            本系統僅供教會成員使用。
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAuth } from '@church/shared/auth';
import { Button } from '../ui';

export default function LoginPage() {
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
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-primary-soft via-bg to-bg px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary text-primary-ink shadow-card mb-5">
            <Building2 size={30} strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-black text-ink tracking-tight mb-2">教會場地借用系統</h1>
          <p className="text-sm text-ink-soft leading-relaxed">請登入以進行空間預約與管理</p>
        </div>

        <Button
          variant="primary"
          fullWidth
          loading={isSigningIn}
          onClick={handleGoogleSignIn}
          className="!min-h-[52px] text-base"
        >
          {!isSigningIn && (
            <svg width="18" height="18" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span>{isSigningIn ? '正在前往 Google…' : '使用 Google 帳號登入'}</span>
        </Button>

        {loginError && (
          <p role="alert" className="mt-4 text-center text-xs font-semibold text-danger">{loginError}</p>
        )}

        <p className="mt-6 text-center text-xs text-ink-faint leading-relaxed">
          登入即表示您同意本系統的使用規範。<br />
          本系統僅供教會成員使用。
        </p>
      </div>
    </div>
  );
}

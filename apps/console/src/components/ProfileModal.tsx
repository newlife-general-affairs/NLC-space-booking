import { X, User, CheckCircle2 } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { ROLE_LABEL } from '../navigation';

import type { User as SupabaseUser } from '@supabase/supabase-js';
interface ProfileModalProps {
  user: SupabaseUser;
  role: string | null;
  profileForm: { fullName: string; phone: string; pastoralZone: string };
  profileSaveStatus: string;
  onChange: (form: { fullName: string; phone: string; pastoralZone: string }) => void;
  onSave: () => void;
  onClose: () => void;
  isForceFill?: boolean;
}

export default function ProfileModal({
  user, role, profileForm, profileSaveStatus,
  onChange, onSave, onClose, isForceFill = false,
}: ProfileModalProps) {
  useEscapeKey(onClose, !isForceFill);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={isForceFill ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md animate-scale-in">
        <div role="dialog" aria-modal="true" aria-label="個人常用資料" className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                <User size={15} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 leading-tight">個人常用資料</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">設定後系統將自動填寫預約表單</p>
              </div>
            </div>
            {!isForceFill && (
              <button
                onClick={onClose}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                aria-label="關閉"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 max-h-[55dvh] overflow-y-auto scrollbar-hidden">
            {/* Email (disabled) */}
            <div>
              <label className="label" htmlFor="profile-email">帳號 Email</label>
              <input
                id="profile-email"
                type="text"
                disabled
                value={user?.email || ''}
                className="input opacity-60 cursor-not-allowed"
              />
            </div>

            {/* Role badge */}
            <div>
              <label className="label">權限角色</label>
              <span className="badge-brand text-xs">
                {ROLE_LABEL[role || ''] || role}
              </span>
            </div>

            {/* Full name */}
            <div>
              <label className="label" htmlFor="profile-fullname">
                借用人姓名 <span className="text-rose-500 ml-0.5">*</span>
              </label>
              <input
                id="profile-fullname"
                type="text"
                value={profileForm.fullName}
                onChange={e => onChange({ ...profileForm, fullName: e.target.value })}
                className="input"
                placeholder="輸入您的真實姓名"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="label" htmlFor="profile-phone">聯絡電話</label>
              <input
                id="profile-phone"
                type="tel"
                value={profileForm.phone}
                onChange={e => onChange({ ...profileForm, phone: e.target.value })}
                className="input"
                placeholder="輸入您的電話號碼"
              />
            </div>

            {/* Pastoral zone */}
            <div>
              <label className="label" htmlFor="profile-pastoral-zone">所屬牧區</label>
              <input
                id="profile-pastoral-zone"
                type="text"
                value={profileForm.pastoralZone}
                onChange={e => onChange({ ...profileForm, pastoralZone: e.target.value })}
                className="input"
                placeholder="例如：大專青草區"
              />
            </div>
          </div>

          {/* Success toast */}
          {profileSaveStatus && (
            <div className="mx-6 mb-4 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-medium text-emerald-700">{profileSaveStatus}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-2.5 px-6 pb-6 pt-4 border-t border-slate-100">
            {!isForceFill && (
              <button onClick={onClose} className="btn-outline flex-1 py-2.5">
                取消
              </button>
            )}
            <button
              onClick={onSave}
              className="btn-primary flex-1 py-2.5"
            >
              確認儲存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


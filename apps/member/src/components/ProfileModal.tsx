import { CheckCircle2 } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Button, Sheet, TextField } from '../ui';

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

const ROLE_LABEL: Record<string, string> = {
  system_admin: '系統管理員',
  admin: '同工管理員',
  inspector: '查察員',
  user: '一般會眾',
};

export default function ProfileModal({
  user, role, profileForm, profileSaveStatus,
  onChange, onSave, onClose, isForceFill = false,
}: ProfileModalProps) {
  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!isForceFill}
      title="個人常用資料"
      footer={
        <div className="flex gap-2.5">
          {!isForceFill && <Button variant="secondary" fullWidth onClick={onClose}>取消</Button>}
          <Button variant="primary" fullWidth onClick={onSave}>確認儲存</Button>
        </div>
      }
    >
      <p className="text-xs text-ink-faint -mt-2 mb-4">設定後系統將自動填寫預約表單</p>

      <div className="space-y-4">
        <TextField label="帳號 Email" disabled value={user?.email || ''} className="opacity-50" />

        <div>
          <label className="label">權限角色</label>
          <span className="badge-brand">{ROLE_LABEL[role || ''] || role}</span>
        </div>

        <TextField
          label="借用人姓名" required
          value={profileForm.fullName}
          onChange={e => onChange({ ...profileForm, fullName: e.target.value })}
          placeholder="輸入您的真實姓名"
        />
        <TextField
          label="聯絡電話" type="tel"
          value={profileForm.phone}
          onChange={e => onChange({ ...profileForm, phone: e.target.value })}
          placeholder="輸入您的電話號碼"
        />
        <TextField
          label="所屬牧區"
          value={profileForm.pastoralZone}
          onChange={e => onChange({ ...profileForm, pastoralZone: e.target.value })}
          placeholder="例如：大專青年區"
        />
      </div>

      {profileSaveStatus && (
        <div className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-success/10 rounded-xl">
          <CheckCircle2 size={14} className="text-success shrink-0" />
          <span className="text-xs font-medium text-success">{profileSaveStatus}</span>
        </div>
      )}
    </Sheet>
  );
}

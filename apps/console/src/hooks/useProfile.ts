import { useState } from 'react';
import { apiFetchProfile, apiSaveProfile } from '@church/shared/api';

interface UseProfileOptions {
  getToken: () => string;
  onSaved?: (data: { fullName: string; phone: string; pastoralZone: string }) => void;
}

export function useProfile({ getToken, onSaved }: UseProfileOptions) {
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', pastoralZone: '' });
  const [profileSaveStatus, setProfileSaveStatus] = useState('');

  const openProfile = async () => {
    try {
      const data = await apiFetchProfile(getToken());
      if (data) {
        setProfileForm({
          fullName: data.full_name || '',
          phone: data.phone || '',
          pastoralZone: data.pastoral_zone || '',
        });
      }
    } catch (err) {
      console.error(err);
    }
    setProfileModalOpen(true);
  };

  const saveProfile = async () => {
    if (!profileForm.fullName.trim()) {
      setProfileSaveStatus('❌ 常用借用人姓名為必填欄位');
      return;
    }
    try {
      const res = await apiSaveProfile(getToken(), profileForm);
      if (res.ok) {
        setProfileSaveStatus('🎉 個人常用資料更新成功！');
        onSaved?.(profileForm);
        setTimeout(() => {
          setProfileSaveStatus('');
          setProfileModalOpen(false);
        }, 1000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setProfileSaveStatus(`❌ 儲存失敗：${errData.error || '請重試'}`);
      }
    } catch {
      setProfileSaveStatus('❌ 網路錯誤');
    }
  };

  return {
    profileModalOpen, setProfileModalOpen,
    profileForm, setProfileForm,
    profileSaveStatus,
    openProfile,
    saveProfile,
  };
}

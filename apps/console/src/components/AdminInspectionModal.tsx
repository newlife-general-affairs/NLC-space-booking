import { useState } from 'react';
import { apiToggleReturn, apiAssignCleaning } from '@church/shared/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

import type { Booking } from '@church/shared/types';
interface AdminInspectionModalProps {
  booking: Booking;
  getToken: () => string;
  onSuccess: (msg: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}

const BASE_CHECKLIST = {
  powerOff: false,
  tablesRestored: false,
  trashCleared: false,
  doorsLocked: false,
};

export default function AdminInspectionModal({
  booking,
  getToken,
  onSuccess,
  onClose,
  onRefresh,
}: AdminInspectionModalProps) {
  const rawAssignments = booking.cleaning_assignments || '';
  const parts = rawAssignments.split('::');
  const spacesList = parts[0] || '';
  const progressKeys = parts[2] ? parts[2].split(',') : [];

  const assignedSpaces = spacesList
    ? spacesList.split(',').map((s: string) => s.trim()).filter((s: string) => s && s !== '無另外分配')
    : [];

  useEscapeKey(onClose);

  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { ...BASE_CHECKLIST };
    assignedSpaces.forEach((space: string) => {
      init[`cleaning_${space}`] = false;
    });
    progressKeys.forEach((key: string) => {
      if (key in init || key.startsWith('cleaning_')) {
        init[key] = true;
      }
    });
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  const isAllChecked = Object.values(checklist).every(v => v === true);

  const toggle = (key: string, checked: boolean) =>
    setChecklist(prev => ({ ...prev, [key]: checked }));

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await apiToggleReturn(getToken(), booking.id, true);
      if (res.ok) {
        onSuccess('🎉 檢查審核通過，場地已歸還成功！');
        onClose();
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || '歸還核可失敗，請重試');
      }
    } catch {
      alert('網路連線異常，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('確定要退回此預約的歸還審核嗎？系統將為使用者保留您目前勾選合格的項目，並通知其進行改善。')) return;
    setSubmitting(true);
    try {
      const progress = Object.entries(checklist)
        .filter(([, checked]) => checked)
        .map(([key]) => key)
        .join(',');

      const newCleanAssign = progress
        ? `${assignedSpaces.join(',')}::rejected::${progress}`
        : `${assignedSpaces.join(',')}::rejected`;

      const res = await apiAssignCleaning(getToken(), booking.id, newCleanAssign);
      if (res.ok) {
        onSuccess('❌ 審核已退回！已為使用者保留已合格項目，並通知其進行改善。');
        onClose();
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || '操作失敗，請重試');
      }
    } catch {
      alert('網路連線異常，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const checkItem = (key: string, label: string, desc: string, checked: boolean) => (
    <label key={key} className="flex items-start gap-3 cursor-pointer group py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => toggle(key, e.target.checked)}
        className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4.5 h-4.5"
      />
      <div className="select-none">
        <div className="text-sm font-bold text-slate-800 group-hover:text-slate-950 transition-colors">
          {label}
        </div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
    </label>
  );

  const roomName = booking.rooms?.name || booking.room_name || '指定空間';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-label="退還場地稽核" className="bg-white rounded-3xl p-5 sm:p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 relative border border-slate-100 max-h-[82dvh] sm:max-h-[85dvh] overflow-y-auto flex flex-col min-h-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉視窗"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors font-bold text-lg select-none"
        >
          ✕
        </button>
        
        <h3 className="text-2xl font-black text-slate-800 mb-2 shrink-0">🔍 現場實地安全清潔稽核</h3>
        <p className="text-slate-500 text-sm mb-6 shrink-0">
          管理員您好，正在稽核由 <strong className="text-indigo-600">{booking.full_name}</strong> 借用的場地：<strong className="text-slate-800">{roomName}</strong>。請實地查驗下列項目並勾選確認：
        </p>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
          {checkItem(
            'powerOff',
            '🔌 電源與電器關閉',
            '確認現場冷氣、電燈、投影機及電子設備均已完全關閉',
            !!checklist.powerOff
          )}
          {checkItem(
            'tablesRestored',
            '🪑 桌椅收拾與還原',
            '確認桌椅已收拾排列整齊，並恢復借用前的原狀',
            !!checklist.tablesRestored
          )}
          {checkItem(
            'trashCleared',
            '🗑️ 環境與垃圾清潔',
            '確認現場無殘留垃圾、髒污，環境恢復整潔',
            !!checklist.trashCleared
          )}
          {checkItem(
            'doorsLocked',
            '🔒 門窗上鎖確認',
            '確認所有窗戶已緊閉，出入口門鎖已上鎖鎖閉',
            !!checklist.doorsLocked
          )}

          {assignedSpaces.length > 0 && (
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
              <div className="text-xs font-black text-indigo-600 tracking-wider uppercase">
                🧹 指派公共區域打掃查核
              </div>
              {assignedSpaces.map((space: string) =>
                checkItem(
                  `cleaning_${space}`,
                  `公共區打掃：${space}`,
                  `已實地查驗指派的「${space}」打掃狀況，符合清潔標準`,
                  !!checklist[`cleaning_${space}`]
                )
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 shrink-0 mt-6 w-full">
          <button
            onClick={onClose}
            className="px-4 py-3 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-xl transition-all text-sm select-none"
          >
            取消
          </button>
          <button
            disabled={submitting}
            onClick={handleReject}
            className="flex-1 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-sm hover:scale-[1.01] active:scale-[0.99]"
          >
            ❌ 檢查退回
          </button>
          <button
            disabled={submitting || !isAllChecked}
            onClick={handleConfirm}
            className={`flex-1 font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-md ${
              !isAllChecked
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            {submitting ? '核可中...' : '檢查通過'}
          </button>
        </div>
      </div>
    </div>
  );
}

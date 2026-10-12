import { useState } from 'react';
import type { Booking, PublicSpace } from '@church/shared/types';
import { apiAssignCleaning } from '@church/shared/api';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface AssignCleaningModalProps {
  booking: Booking;
  bookings?: Booking[];
  publicSpaces: PublicSpace[];
  getToken: () => string;
  onSuccess: (msg: string) => void;
  onClose: () => void;
  onRefresh: () => void;
}

export default function AssignCleaningModal({
  booking, bookings = [], publicSpaces, getToken, onSuccess, onClose, onRefresh,
}: AssignCleaningModalProps) {
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>(() => {
    if (!booking.cleaning_assignments) return [];
    const spacesPart = booking.cleaning_assignments.split('::')[0];
    return spacesPart.split(',').map(s => s.trim()).filter(Boolean);
  });
  const [customSpace, setCustomSpace] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEscapeKey(onClose);

  const toggleSpace = (space: string) => {
    setSelectedSpaces(prev => {
      if (space === '無另外分配') {
        return prev.includes('無另外分配') ? [] : ['無另外分配'];
      }
      const filtered = prev.filter(s => s !== '無另外分配');
      return filtered.includes(space) ? filtered.filter(s => s !== space) : [...filtered, space];
    });
  };

  const getOverlappingAssignedSpaces = (): string[] => {
    if (!bookings || !Array.isArray(bookings)) return [];
    
    const targetStart = booking.start_time;
    const targetEnd = booking.end_time;
    const targetDate = booking.booking_date;
    
    const spaces = new Set<string>();
    
    bookings.forEach(b => {
      if (b.id !== booking.id && b.booking_date === targetDate && b.status === 'approved') {
        const startOverlap = b.start_time < targetEnd && b.end_time > targetStart;
        if (startOverlap && b.cleaning_assignments) {
          const spacesPart = b.cleaning_assignments.split('::')[0];
          spacesPart.split(',').map((s: string) => s.trim()).forEach((s: string) => {
            if (s && s !== '無另外分配') {
              spaces.add(s);
            }
          });
        }
      }
    });
    
    return Array.from(spaces);
  };

  const addCustomSpace = () => {
    const s = customSpace.trim();
    if (s && s !== '無另外分配') {
      if (getOverlappingAssignedSpaces().includes(s)) {
        alert(`❌ 此時段已有其他預約指派打掃「${s}」，不可重複指派！`);
        return;
      }
      if (!selectedSpaces.includes(s)) {
        setSelectedSpaces(prev => {
          const filtered = prev.filter(x => x !== '無另外分配');
          return [...filtered, s];
        });
      }
      setCustomSpace('');
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await apiAssignCleaning(getToken(), booking.id, selectedSpaces.join(','));
      const data = await res.json();
      if (res.ok) {
        onSuccess('🎉 ' + data.message);
        onClose();
        onRefresh();
      } else {
        alert(data.error || '分配失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ['廁所', '空間', '垃圾桶'];
  const catIcon: Record<string, string> = { 廁所: '🚻', 空間: '🏢', 垃圾桶: '🗑️' };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-label="指派公共區域清潔" className="bg-white rounded-3xl p-5 sm:p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 relative border border-slate-100 max-h-[82dvh] sm:max-h-[85dvh] overflow-y-auto">
        <button type="button" onClick={onClose} aria-label="關閉視窗" className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors font-bold text-lg">✕</button>
        <h3 className="text-2xl font-black text-slate-800 mb-2">🧹 指派公共區域清潔</h3>
        <p className="text-slate-400 text-sm mb-6">
          指派給借用者 <strong className="text-indigo-600">{booking.full_name}</strong> 在使用完畢後，除了原借用的{' '}
          <strong className="text-indigo-600">{booking.room_name}</strong> 之外，需額外協助打掃清潔的公共空間：
        </p>

        <div className="space-y-6">
          {/* 已選區域 */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">已指派區域：</div>
            {selectedSpaces.length === 0 ? (
              <div className="text-sm italic text-slate-400 bg-slate-50 border border-dashed border-slate-200 py-3 text-center rounded-xl">尚未分配任何公共空間</div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                {selectedSpaces.map(space => (
                  <span key={space} className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-white text-xs font-black rounded-full shadow-sm">
                    {space}
                    <button
                      type="button"
                      onClick={() => toggleSpace(space)}
                      aria-label={`移除公共空間：${space}`}
                      className="hover:bg-emerald-600 hover:text-red-100 rounded-full min-w-[24px] min-h-[24px] -m-1 flex items-center justify-center transition-colors text-[10px]"
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 無另外分配快速按鈕 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <div className="text-sm font-bold text-slate-800">無另外分配</div>
              <div className="text-[11px] text-slate-400 mt-0.5">僅需清理原借用場地，免打掃其他公共區域</div>
            </div>
            <button
              onClick={() => toggleSpace('無另外分配')}
              className={`px-4 py-2 text-xs font-black rounded-xl border transition-all active:scale-95 duration-200 shadow-sm ${
                selectedSpaces.includes('無另外分配')
                  ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
              }`}
            >
              {selectedSpaces.includes('無另外分配') ? '已選擇 ✓' : '選擇'}
            </button>
          </div>

          {/* 快速選擇 */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">選擇公共區域 (依分類)：</div>
            {publicSpaces.length === 0 ? (
              <div className="text-xs text-slate-400 italic bg-slate-50 border border-slate-100 py-3 text-center rounded-xl">無設定之公共區域，請於管理後台新增。</div>
            ) : (
              <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                {categories.map(cat => {
                  const inCat = publicSpaces.filter(ps => (ps.category || '空間') === cat);
                  if (inCat.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="text-[11px] font-black text-slate-500 flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md w-fit">
                        <span>{catIcon[cat]}</span><span>{cat}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {inCat.map(ps => {
                          const isSelected = selectedSpaces.includes(ps.name);
                          const isOverlappingAssigned = getOverlappingAssignedSpaces().includes(ps.name);
                          return (
                            <button
                              key={ps.id}
                              disabled={isOverlappingAssigned}
                              onClick={() => toggleSpace(ps.name)}
                              className={`px-3 py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                                isSelected
                                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm scale-95 font-extrabold'
                                  : isOverlappingAssigned
                                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                              }`}
                              title={isOverlappingAssigned ? '此公共區域已在此時段被其他預約指派清潔' : ''}
                            >
                              {ps.name} {isOverlappingAssigned ? '(同段已指派)' : isSelected ? '✓' : '+'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 自訂空間 */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">手動指派其他公共空間：</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="例如：副堂前走道、三樓會議室..."
                value={customSpace}
                onChange={e => setCustomSpace(e.target.value)}
                className="flex-1 px-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSpace(); } }}
              />
              <button
                onClick={addCustomSpace}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-xl text-sm transition-all"
              >
                新增
              </button>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button onClick={onClose} className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-3 px-4 rounded-xl transition-all">取消</button>
            <button
              disabled={submitting}
              onClick={handleConfirm}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              {submitting ? '儲存中...' : '確認指派'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

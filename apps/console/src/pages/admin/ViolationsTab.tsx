import { useCallback, useState, useEffect } from 'react';
import { AlertOctagon, Plus, Edit2, Trash2 } from 'lucide-react';
import {
  apiAddViolation,
  apiUpdateViolation,
  apiDeleteViolation,
  apiFetchAdminBookings,
} from '@church/shared/api';
import type { Booking, ViolationRecord } from '@church/shared/types';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ViolationsTabProps {
  data: ViolationRecord[];
  getToken: () => string;
  onRefresh: () => void;
  currentBranch: string;
}

export default function ViolationsTab({ data, getToken, onRefresh, currentBranch }: ViolationsTabProps) {
  const [submitting, setSubmitting] = useState(false);
  
  // Modals / Inputs
  const [editingViolation, setEditingViolation] = useState<ViolationRecord | null>(null);
  const [editReason, setEditReason] = useState('');
  const [editCustomReason, setEditCustomReason] = useState('');
  
  const [addingViolation, setAddingViolation] = useState(false);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [newReason, setNewReason] = useState('租借未使用');
  const [newCustomReason, setNewCustomReason] = useState('');

  useEscapeKey(() => setAddingViolation(false), addingViolation);
  useEscapeKey(() => setEditingViolation(null), !!editingViolation);

  // Month Selection State for Dashboard
  const [selectedSummaryMonth, setSelectedSummaryMonth] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).substring(0, 7)
  );

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Reset selection when source data refreshes or changes
  useEffect(() => {
    setSelectedIds([]);
  }, [data]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'cancelled' | 'all'>('active');

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [searchTerm, selectedStatus]);

  // Filter and sort violations client-side
  const filteredViolations = (Array.isArray(data) ? data : []).filter(v => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (v.room_name || '').toLowerCase().includes(searchLower) ||
      (v.full_name || '').toLowerCase().includes(searchLower) ||
      (v.phone || '').toLowerCase().includes(searchLower) ||
      (v.user_email || '').toLowerCase().includes(searchLower) ||
      (v.reason || '').toLowerCase().includes(searchLower);

    const matchesStatus =
      selectedStatus === 'all'
        ? true
        : selectedStatus === 'cancelled'
        ? !!v.is_cancelled
        : !v.is_cancelled;

    return matchesSearch && matchesStatus;
  });

  // Grouping logic for dashboard
  const pastorSummary = (() => {
    const summary: Record<string, { points: number; count: number; suspended: boolean }> = {};
    if (!Array.isArray(data)) return summary;
    
    data.forEach(v => {
      if (v.is_cancelled) return;
      const vMonth = (v.created_at || v.booking_date || '').substring(0, 7);
      if (vMonth !== selectedSummaryMonth) return;
      
      const pZone = v.pastoral_zone || '其他';
      if (!summary[pZone]) {
        summary[pZone] = { points: 0, count: 0, suspended: false };
      }
      summary[pZone].points += v.points || 0;
      if (v.violation_type !== 'late_return' && v.reason !== '未完整復歸場地') {
        summary[pZone].count += 1;
      }
    });

    Object.keys(summary).forEach(pZone => {
      const { points, count } = summary[pZone];
      summary[pZone].suspended = points >= 5 || count >= 2;
    });

    return summary;
  })();

  // Fetch all bookings for selection dropdown
  const loadEligibleBookings = useCallback(async () => {
    try {
      const res = await apiFetchAdminBookings(getToken(), currentBranch);
      if (Array.isArray(res)) {
        // Filter: status is approved, and it doesn't already have a violation
        const eligible = res.filter((b: Booking) => b.status === 'approved' && !b.violation);
        setAllBookings(eligible);
        if (eligible.length > 0) {
          setSelectedBookingId(eligible[0].id);
        } else {
          setSelectedBookingId(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentBranch, getToken]);

  useEffect(() => {
    if (addingViolation) {
      loadEligibleBookings();
    }
  }, [addingViolation, loadEligibleBookings]);

  const handleStartEdit = (record: ViolationRecord) => {
    setEditingViolation(record);
    const standardReasons = ['租借未使用', '未完整復歸場地'];
    if (standardReasons.includes(record.reason)) {
      setEditReason(record.reason);
      setEditCustomReason('');
    } else {
      setEditReason('其他原因');
      setEditCustomReason(record.reason);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingViolation) return;
    const finalReason = editReason === '其他原因' ? editCustomReason.trim() : editReason;
    if (!finalReason) {
      alert('請填寫或選擇違規原因');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiUpdateViolation(getToken(), editingViolation.booking_id, finalReason);
      if (res.ok) {
        setEditingViolation(null);
        onRefresh();
        alert('違規原因更新成功！');
      } else {
        const err = await res.json();
        alert(err.error || '更新失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddViolationSubmit = async () => {
    if (!selectedBookingId) {
      alert('請選擇要記點的預約記錄');
      return;
    }
    const finalReason = newReason === '其他原因' ? newCustomReason.trim() : newReason;
    if (!finalReason) {
      alert('請填寫或選擇違規原因');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiAddViolation(getToken(), selectedBookingId, finalReason);
      if (res.ok) {
        setAddingViolation(false);
        setNewCustomReason('');
        onRefresh();
        alert('成功記點違規！');
      } else {
        const err = await res.json();
        alert(err.error || '新增失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: ViolationRecord) => {
    const actionText = record.is_cancelled ? '徹底刪除' : '撤銷';
    if (!window.confirm(`確定要${actionText}此筆違規記錄嗎？\n預約借用人：${record.full_name}\n違規項目：${record.reason}`)) return;
    
    setSubmitting(true);
    try {
      const res = await apiDeleteViolation(getToken(), record.booking_id || record.id);
      if (res.ok) {
        onRefresh();
        alert(`違規記錄已成功${actionText}。`);
      } else {
        const err = await res.json();
        alert(err.error || '操作失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSelect = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredViolations.map((r) => r.booking_id || r.id).filter((id): id is number => Boolean(id)));
    } else {
      setSelectedIds([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    const selectedRecords = data.filter(r => selectedIds.includes(r.booking_id || r.id));
    const hasActive = selectedRecords.some(r => !r.is_cancelled);
    const actionText = hasActive ? '撤銷' : '徹底刪除';

    if (!window.confirm(`確定要${actionText}這 ${selectedIds.length} 筆違規記錄嗎？此動作無法復原。`)) return;

    setSubmitting(true);
    try {
      const results = await Promise.all(selectedIds.map(id => apiDeleteViolation(getToken(), id)));
      const allOk = results.every(res => res.ok);
      setSelectedIds([]); // Clear selection state immediately
      if (allOk) {
        alert(`已成功${actionText} ${selectedIds.length} 筆違規記錄！`);
      } else {
        alert(`部分違規記錄${actionText}失敗，請檢查權限後重試`);
      }
      onRefresh();
    } catch {
      alert('網路錯誤，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2 select-none">
          <AlertOctagon className="text-rose-500" size={20} /> 違規紀錄管理
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {selectedIds.length > 0 && (
            <button
              disabled={submitting}
              onClick={handleDeleteSelected}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 animate-in fade-in duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🗑️ {submitting ? '處理中...' : `${
                data.filter(r => selectedIds.includes(r.booking_id || r.id)).some(r => !r.is_cancelled)
                  ? '撤銷所選違規'
                  : '徹底刪除所選'
              } (${selectedIds.length})`}
            </button>
          )}
          <button
            onClick={() => setAddingViolation(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
          >
            <Plus size={14} /> 新增違規記點
          </button>
        </div>
      </div>

      {/* ── 牧區累計與停權狀態 Dashboard ── */}
      <div className="bg-slate-50 border border-slate-200/80 p-6 rounded-3xl shadow-sm select-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              📊 牧區違規統計與停權狀態看板
            </h4>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              單月累計扣滿 5 點或違規達 2 次，次月取消申請資格
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs font-bold text-slate-500">選擇統計月份：</label>
            <input
              type="month"
              value={selectedSummaryMonth}
              onChange={e => setSelectedSummaryMonth(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
            />
          </div>
        </div>

        {Object.keys(pastorSummary).length === 0 ? (
          <div className="text-center p-8 bg-white border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500 italic">
            此月份無任何未撤銷的違規扣點紀錄
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
            {Object.entries(pastorSummary).map(([pZone, stats]) => {
              const now = new Date();
              const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
              const daysLeft = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              // Heatmap backgrounds based on points
              const cardColorClass = stats.suspended
                ? 'border-rose-500/30 bg-rose-500/5 ring-1 ring-rose-500/10'
                : stats.points >= 3
                ? 'border-amber-500/30 bg-amber-500/5 ring-1 ring-amber-500/10'
                : 'border-slate-200 bg-white';

              return (
                <div
                  key={pZone}
                  className={`p-4 border rounded-2xl shadow-md transition-all hover:shadow-lg flex flex-col justify-between ${cardColorClass}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="font-extrabold text-slate-800 text-sm">{pZone}</div>
                    {stats.suspended ? (
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                        次月停權 ❌
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        資格正常 ✅
                      </span>
                    )}
                  </div>
                  
                  {stats.suspended && (
                    <div className="text-[10px] font-extrabold text-rose-700 mt-2 bg-rose-50 p-1.5 rounded-lg border border-rose-500/10 text-center">
                      ⏳ 停權倒數生效剩餘 {daysLeft} 天
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200 text-center select-none">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">累計扣分</span>
                      <span className={`text-sm font-black ${stats.points >= 5 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {stats.points} 點
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">違規次數</span>
                      <span className={`text-sm font-black ${stats.count >= 2 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {stats.count} 次
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="p-6 bg-slate-50/60 border border-slate-200/80 rounded-2xl mb-6 shadow-sm select-none backdrop-blur-sm">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <span>🔍</span> 搜尋與篩選條件
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 文字搜尋 */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜尋姓名、場地、原因、信箱..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-3.5 pr-8 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium text-slate-700 shadow-sm transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* 狀態篩選 */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value as 'active' | 'cancelled' | 'all')}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-bold text-slate-700 shadow-sm transition-all cursor-pointer"
            >
              <option value="active">● 顯示中（未撤銷）</option>
              <option value="cancelled">● 已撤銷</option>
              <option value="all">● 所有狀態</option>
            </select>
          </div>
        </div>
      </div>

      {/* 違規列表表格 */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200 select-none">
              <th className="p-4 w-10 text-center select-none">
                <input
                  type="checkbox"
                  disabled={submitting}
                  checked={selectedIds.length === filteredViolations.length && filteredViolations.length > 0}
                  onChange={e => handleToggleAll(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                />
              </th>
              <th className="p-4">借用空間與日期</th>
              <th className="p-4">借用人資訊</th>
              <th className="p-4">用途與目的</th>
              <th className="p-4">違規項目與扣點</th>
              <th className="p-4">紀錄類型</th>
              <th className="p-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredViolations.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 italic bg-white rounded-b-2xl">
                  {data.length === 0 ? '目前據點無任何違規記點紀錄' : '查無符合篩選條件的記錄'}
                </td>
              </tr>
            ) : (
              filteredViolations.map((r, index: number) => {
                const isSelected = selectedIds.includes(r.booking_id || r.id);
                return (
                  <tr key={r.id || r.booking_id || index} className="hover:bg-slate-50/40 transition-colors">
                    <td className="p-4 w-10 text-center">
                      <input
                        type="checkbox"
                        disabled={submitting}
                        checked={isSelected}
                        onChange={e => handleToggleSelect(r.booking_id || r.id, e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-extrabold text-slate-800 text-sm">{r.room_name}</div>
                      <div className="text-xs text-slate-500 font-semibold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded inline-block mt-1">{r.booking_date}</div>
                      <div className="text-[10px] text-indigo-600 font-bold block mt-1.5">{r.start_time?.substring(0, 5)} - {r.end_time?.substring(0, 5)}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        {r.full_name}
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[9px] border border-indigo-100">
                          {r.pastoral_zone || '無牧區'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">📞 {r.phone}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{r.user_email}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs text-slate-600 font-medium max-w-[180px] truncate" title={r.purpose}>
                        {r.purpose}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="inline-block bg-rose-50 text-rose-700 font-black px-2.5 py-1 rounded-lg text-xs border border-rose-100 shadow-sm select-none">
                          🚨 {r.reason}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {r.points > 0 ? (
                            <span className="text-[9px] font-black text-rose-600 bg-rose-50/50 border border-rose-100 px-1.5 py-0.5 rounded">
                              扣 {r.points} 點
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              不扣點 (僅計次)
                            </span>
                          )}
                          {r.is_cancelled && (
                            <span className="text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              已撤銷
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {r.violation_type === 'cancel' ? (
                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full shadow-sm">臨時取消</span>
                      ) : r.violation_type === 'change' ? (
                        <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full shadow-sm">臨時變更</span>
                      ) : r.violation_type === 'no_show' ? (
                        <span className="text-[9px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full shadow-sm">租借未使用</span>
                      ) : r.violation_type === 'late_return' ? (
                        r.is_manual ? (
                          <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full shadow-sm">手動超時</span>
                        ) : (
                          <span className="text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">系統超時</span>
                        )
                      ) : (
                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shadow-sm">手動記點</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {r.booking_id && (
                          <button
                            disabled={submitting}
                            onClick={() => handleStartEdit(r)}
                            className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="編輯原因"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        <button
                          disabled={submitting}
                          onClick={() => handleDelete(r)}
                          className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={r.is_cancelled ? "徹底刪除違規" : "撤銷違規"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>


      {/* 新增違規記點 Modal */}
      {addingViolation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-label="新增違規記點" className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full max-h-[82dvh] overflow-y-auto shadow-2xl relative border border-slate-100 flex flex-col min-h-0">
            <button
              type="button"
              onClick={() => setAddingViolation(false)}
              aria-label="關閉視窗"
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors font-bold text-lg"
            >
              ✕
            </button>
            
            <h3 className="text-xl font-black text-slate-800 mb-4 shrink-0">🚨 新增違規記點</h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-500">選擇違規預約單</label>
                {allBookings.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic">
                    目前無符合記點的預約紀錄（必須是已核可且未被記點的預約）
                  </div>
                ) : (
                  <select
                    value={selectedBookingId || ''}
                    onChange={e => setSelectedBookingId(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl py-2.5 px-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-medium text-sm text-slate-800 bg-white shadow-sm"
                  >
                    {allBookings.map(b => (
                      <option key={b.id} value={b.id}>
                        [{b.booking_date}] {b.room_name || b.rooms?.name} — {b.full_name} ({b.purpose?.substring(0, 10)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500">違規原因</label>
                <div className="space-y-2">
                  {[
                    { val: '租借未使用', label: '租借未使用' },
                    { val: '未完整復歸場地', label: '未完整復歸場地' },
                    { val: '其他原因', label: '其他原因（手動輸入）' },
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="newReason"
                        checked={newReason === opt.val}
                        onChange={() => setNewReason(opt.val)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500/20 focus:ring-indigo-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {newReason === '其他原因' && (
                  <input
                    type="text"
                    placeholder="請輸入自訂違規原因..."
                    value={newCustomReason}
                    onChange={e => setNewCustomReason(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium mt-2 shadow-sm"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6 shrink-0 pt-4 border-t border-slate-100">
              <button
                onClick={() => setAddingViolation(false)}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-2.5 px-4 rounded-xl transition-all text-sm"
              >
                取消
              </button>
              <button
                disabled={submitting || !selectedBookingId}
                onClick={handleAddViolationSubmit}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 text-sm shadow-md"
              >
                確認新增違規
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編輯違規原因 Modal */}
      {editingViolation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-label="編輯違規原因" className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full max-h-[80dvh] overflow-y-auto shadow-2xl relative border border-slate-100 flex flex-col min-h-0">
            <button
              type="button"
              onClick={() => setEditingViolation(null)}
              aria-label="關閉視窗"
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors font-bold text-lg"
            >
              ✕
            </button>
            
            <h3 className="text-xl font-black text-slate-800 mb-4 shrink-0">✏️ 編輯違規原因</h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-1">
                <div><span className="font-bold text-slate-500">預約編號：</span>{editingViolation.booking_id}</div>
                <div><span className="font-bold text-slate-500">借用空間：</span>{editingViolation.room_name}</div>
                <div><span className="font-bold text-slate-500">借用日期：</span>{editingViolation.booking_date}</div>
                <div><span className="font-bold text-slate-500">借用人：</span>{editingViolation.full_name}</div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500">修改原因為</label>
                <div className="space-y-2">
                  {[
                    { val: '租借未使用', label: '租借未使用' },
                    { val: '未完整復歸場地', label: '未完整復歸場地' },
                    { val: '其他原因', label: '其他原因（手動輸入）' },
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="editReason"
                        checked={editReason === opt.val}
                        onChange={() => setEditReason(opt.val)}
                        className="w-4 h-4 text-indigo-605 focus:ring-indigo-500/20 focus:ring-indigo-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {editReason === '其他原因' && (
                  <input
                    type="text"
                    placeholder="請輸入自訂違規原因..."
                    value={editCustomReason}
                    onChange={e => setEditCustomReason(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium mt-2 shadow-sm"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6 shrink-0 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditingViolation(null)}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-2.5 px-4 rounded-xl transition-all text-sm"
              >
                取消
              </button>
              <button
                disabled={submitting}
                onClick={handleSaveEdit}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 text-sm shadow-md"
              >
                確認修改原因
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

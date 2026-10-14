import { useEffect, useState } from 'react';
import { AlertCircle, Plus, X } from 'lucide-react';
import { apiCreateIssue, apiDeleteIssue, apiFetchRooms, apiUpdateIssueStatus } from '@church/shared/api';
import { isVirtualRoom } from '@church/shared/domain/roomGrid';
import type { Issue, Room } from '@church/shared/types';

interface IssuesTabProps {
  data: Issue[];
  currentBranch: string;
  getToken: () => string;
  onRefresh: () => void;
  /** 管理員可變更狀態與刪除；查察員只能回報與檢視 */
  canManage: boolean;
}

const statusLabel: Record<string, string> = { resolved: '已解決', investigating: '處理中', pending: '待處理' };
const statusStyle: Record<string, string> = {
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  investigating: 'bg-blue-50 text-blue-700 border-blue-100',
  pending: 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse',
};

export default function IssuesTab({ data = [], currentBranch, getToken, onRefresh, canManage }: IssuesTabProps) {
  const issuesList = Array.isArray(data) ? data : [];
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!formOpen || rooms.length > 0) return;
    apiFetchRooms(currentBranch)
      .then(d => { if (Array.isArray(d)) setRooms(d.filter((r: Room) => !isVirtualRoom(r.name))); })
      .catch(console.error);
  }, [formOpen, rooms.length, currentBranch]);

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const res = await apiUpdateIssueStatus(getToken(), id, status);
      if (res.ok) onRefresh();
      else { const err = await res.json(); alert(err.error || '更新狀態失敗'); }
    } catch { alert('網路錯誤，請稍後重試'); }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`確定要刪除這 ${selectedIds.length} 筆場地問題回報嗎？此動作無法復原。`)) return;
    try {
      await Promise.all(selectedIds.map(id =>
        apiDeleteIssue(getToken(), id)
      ));
      setSelectedIds([]);
      onRefresh();
    } catch { alert('刪除失敗，部分項目可能未成功刪除'); }
  };

  const handleSubmitReport = async () => {
    if (!roomId || !description.trim()) {
      alert('請選擇場地並填寫問題描述');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiCreateIssue(getToken(), roomId, description.trim());
      if (res.ok) {
        setRoomId('');
        setDescription('');
        setFormOpen(false);
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || '回報失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = (i: Issue) => (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border whitespace-nowrap ${statusStyle[i.status] || statusStyle.pending}`}>
      {statusLabel[i.status] || '待處理'}
    </span>
  );

  const renderActions = (i: Issue) => (
    <div className="flex gap-2 justify-end flex-wrap">
      {i.status === 'pending' && (
        <button onClick={() => handleUpdateStatus(i.id, 'investigating')}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm active:scale-95">⚙️ 處理中</button>
      )}
      {i.status !== 'resolved' && (
        <button onClick={() => handleUpdateStatus(i.id, 'resolved')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm active:scale-95">✓ 已解決</button>
      )}
      {i.status === 'resolved' && <span className="text-slate-400 text-xs font-bold italic">已結案</span>}
    </div>
  );

  const reporterName = (i: Issue) => i.user_profiles?.full_name || i.reported_by || '未知';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2 select-none">
          <AlertCircle className="text-rose-500" size={20} /> 故障回報
        </h3>
        <div className="flex items-center gap-2">
          {canManage && selectedIds.length > 0 && (
            <button onClick={handleDeleteSelected}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5">
              🗑️ 刪除已選 ({selectedIds.length})
            </button>
          )}
          {!formOpen && (
            <button onClick={() => setFormOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5">
              <Plus size={14} /> 回報故障
            </button>
          )}
        </div>
      </div>

      {formOpen && (
        <div className="mb-6 p-4 md:p-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-800">回報場地故障</h4>
            <button type="button" onClick={() => setFormOpen(false)} aria-label="關閉回報表單" className="p-1.5 rounded-lg text-slate-500 hover:bg-white">
              <X size={16} />
            </button>
          </div>
          <select
            value={roomId}
            onChange={e => setRoomId(e.target.value ? Number(e.target.value) : '')}
            aria-label="選擇場地"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white font-bold text-slate-700"
          >
            <option value="">選擇發生問題的場地</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="描述問題，例如：冷氣無法啟動、投影機沒有畫面、門鎖電量不足"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-700 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600">
              取消
            </button>
            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {submitting ? '送出中…' : '送出回報'}
            </button>
          </div>
        </div>
      )}

      {/* 手機：卡片清單 */}
      <div className="md:hidden space-y-3">
        {issuesList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 italic bg-white border border-slate-200 rounded-2xl text-sm">目前尚無任何場地問題回報</div>
        ) : (
          issuesList.map(i => (
            <div key={i.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {canManage && (
                    <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => toggleSelect(i.id)}
                      aria-label={`選取 ${i.rooms?.name || ''} 的回報`}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded shrink-0" />
                  )}
                  <span className="font-extrabold text-slate-800 text-sm truncate">{i.rooms?.name}</span>
                </div>
                {renderStatus(i)}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap break-words">{i.description}</p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">回報人：{reporterName(i)}</span>
                {canManage && renderActions(i)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 桌機：表格 */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-2xl shadow-sm w-full bg-white">
        <table className="w-full text-left text-sm border-collapse bg-white">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-200 select-none">
              {canManage && (
                <th className="p-4 w-12 text-center">
                  <input type="checkbox"
                    checked={issuesList.length > 0 && selectedIds.length === issuesList.length}
                    onChange={e => setSelectedIds(e.target.checked ? issuesList.map(i => i.id) : [])}
                    aria-label="全選"
                    className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-indigo-500 cursor-pointer" />
                </th>
              )}
              <th className="p-4">場地</th>
              <th className="p-4">描述</th>
              <th className="p-4">狀態</th>
              <th className="p-4">回報人</th>
              {canManage && <th className="p-4 text-right">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {issuesList.length === 0 ? (
              <tr><td colSpan={canManage ? 6 : 4} className="p-8 text-center text-slate-400 italic bg-white rounded-b-2xl">目前尚無任何場地問題回報</td></tr>
            ) : (
              issuesList.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/40 transition-colors">
                  {canManage && (
                    <td className="p-4 text-center">
                      <input type="checkbox" checked={selectedIds.includes(i.id)}
                        onChange={() => toggleSelect(i.id)}
                        aria-label={`選取 ${i.rooms?.name || ''} 的回報`}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                    </td>
                  )}
                  <td className="p-4 font-extrabold text-slate-800 text-sm">{i.rooms?.name}</td>
                  <td className="p-4 text-slate-600 text-xs leading-relaxed max-w-md break-words font-medium whitespace-pre-wrap">{i.description}</td>
                  <td className="p-4">{renderStatus(i)}</td>
                  <td className="p-4 text-slate-500 text-xs font-semibold">{reporterName(i)}</td>
                  {canManage && <td className="p-4 text-right">{renderActions(i)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

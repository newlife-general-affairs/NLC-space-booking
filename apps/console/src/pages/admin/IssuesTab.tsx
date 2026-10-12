import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiUpdateIssueStatus, apiDeleteIssue } from '@church/shared/api';
import type { Issue } from '@church/shared/types';

interface IssuesTabProps {
  data: Issue[];
  getToken: () => string;
  onRefresh: () => void;
}

export default function IssuesTab({ data = [], getToken, onRefresh }: IssuesTabProps) {
  const issuesList = Array.isArray(data) ? data : [];
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

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

  const statusLabel: Record<string, string> = { resolved: '已解決', investigating: '處理中', pending: '待處理' };
  const statusStyle: Record<string, string> = {
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    investigating: 'bg-blue-50 text-blue-700 border-blue-100',
    pending: 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2 select-none">
          <AlertCircle className="text-rose-500" size={20} /> 問題回報
        </h3>
        {selectedIds.length > 0 && (
          <button onClick={handleDeleteSelected}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 animate-in fade-in duration-200">
            🗑️ 刪除已選 ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm w-full bg-white">
        <table className="w-full text-left text-sm border-collapse bg-white">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-200 select-none">
              <th className="p-4 w-12 text-center">
                <input type="checkbox"
                  checked={issuesList.length > 0 && selectedIds.length === issuesList.length}
                  onChange={e => setSelectedIds(e.target.checked ? issuesList.map(i => i.id) : [])}
                  className="w-4 h-4 text-indigo-600 border-slate-200 rounded focus:ring-indigo-500 cursor-pointer" />
              </th>
              <th className="p-4">場地</th>
              <th className="p-4">描述</th>
              <th className="p-4">狀態</th>
              <th className="p-4">回報人</th>
              <th className="p-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {issuesList.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic bg-white rounded-b-2xl">目前尚無任何場地問題回報</td></tr>
            ) : (
              issuesList.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="p-4 text-center">
                    <input type="checkbox" checked={selectedIds.includes(i.id)}
                      onChange={() => toggleSelect(i.id)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                  </td>
                  <td className="p-4 font-extrabold text-slate-800 text-sm">{i.rooms?.name}</td>
                  <td className="p-4 text-slate-600 text-xs leading-relaxed max-w-md break-words font-medium whitespace-pre-wrap">{i.description}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${statusStyle[i.status] || statusStyle.pending}`}>
                      {statusLabel[i.status] || '待處理'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 text-xs font-semibold">{i.user_profiles?.full_name || i.reported_by || '未知'}</td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

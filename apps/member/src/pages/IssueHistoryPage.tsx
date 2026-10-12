import { AlertTriangle } from 'lucide-react';
import type { Issue } from '@church/shared/types';

interface IssueHistoryPageProps {
  issues: Issue[];
  currentBranch: string | null;
}

export default function IssueHistoryPage({ issues, currentBranch }: IssueHistoryPageProps) {
  const filtered = issues.filter(i => i.rooms?.branch === currentBranch);

  const statusLabel: Record<string, string> = {
    resolved: '已解決',
    investigating: '處理中',
    pending: '待處理',
  };
  const statusStyle: Record<string, string> = {
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    investigating: 'bg-blue-50 text-blue-700 border-blue-100',
    pending: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="text-indigo-500" />
          我回報的場地問題
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-[var(--ink-soft)] text-sm border-b border-slate-200">
              <th className="p-4 font-semibold">回報場地</th>
              <th className="p-4 font-semibold">問題描述</th>
              <th className="p-4 font-semibold">回報時間</th>
              <th className="p-4 font-semibold">狀態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-[var(--ink-soft)] bg-slate-50/50">目前尚無任何場地問題回報記錄</td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-800">{row.rooms?.name}</td>
                  <td className="p-4 text-slate-600 max-w-md break-words">{row.description}</td>
                  <td className="p-4 text-[var(--ink-soft)] text-xs">{new Date(row.created_at).toLocaleString('zh-TW', { hour12: false })}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${statusStyle[row.status] || statusStyle.pending}`}>
                      {statusLabel[row.status] || '待處理'}
                    </span>
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

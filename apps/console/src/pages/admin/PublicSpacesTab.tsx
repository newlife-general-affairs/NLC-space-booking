import { useState } from 'react';
import { Sparkles, Trash2, Edit, Save, X } from 'lucide-react';
import { apiCreatePublicSpace, apiUpdatePublicSpace, apiDeletePublicSpace } from '@church/shared/api';
import type { PublicSpace } from '@church/shared/types';

interface PublicSpacesTabProps {
  data: PublicSpace[];
  currentBranch: string;
  getToken: () => string;
  onRefresh: () => void;
}

type SortField = 'name' | 'category' | 'sort_order';

export default function PublicSpacesTab({ data, currentBranch, getToken, onRefresh }: PublicSpacesTabProps) {
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('空間');
  const [newSortOrder, setNewSortOrder] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('空間');
  const [editSortOrder, setEditSortOrder] = useState('0');
  const [sortBy, setSortBy] = useState<SortField>('sort_order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const sortIcon = (field: SortField) => sortBy === field ? (sortDir === 'asc' ? '▲' : '▼') : '↕';

  const sorted = [...data].sort((a, b) => {
    let va = a[sortBy] ?? 0;
    let vb = b[sortBy] ?? 0;
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      const res = await apiCreatePublicSpace(getToken(), { name, branch: currentBranch, category: newCategory, sort_order: Number(newSortOrder) || 0 });
      if (res.ok) { setNewName(''); setNewSortOrder('0'); onRefresh(); }
      else { const err = await res.json(); alert(err.error || '新增失敗'); }
    } catch { alert('網路錯誤，請稍後重試'); }
    finally { setSubmitting(false); }
  };

  const handleUpdate = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    try {
      const res = await apiUpdatePublicSpace(getToken(), id, { name, category: editCategory, sort_order: Number(editSortOrder) || 0, branch: currentBranch });
      if (res.ok) { setEditingId(null); onRefresh(); }
      else { const err = await res.json(); alert(err.error || '更新失敗'); }
    } catch { alert('網路錯誤，請稍後重試'); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`確定要刪除「${name}」公共空間嗎？此操作無法還原。`)) return;
    try {
      const res = await apiDeletePublicSpace(getToken(), id);
      if (res.ok) {
        setEditingId(null);
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || '刪除失敗');
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    }
  };

  const catBadge = (cat: string) => {
    const map: Record<string, string> = { 
      廁所: 'bg-blue-50 text-blue-700 border-blue-100', 
      垃圾桶: 'bg-slate-100 text-slate-700 border-slate-200', 
      空間: 'bg-amber-50 text-amber-705 border-amber-200' 
    };
    const icon: Record<string, string> = { 廁所: '🚻 廁所', 垃圾桶: '🗑️ 垃圾桶', 空間: '🏢 空間' };
    return <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border shadow-sm select-none ${map[cat] || map['空間']}`}>{icon[cat] || cat}</span>;
  };

  const catSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full font-bold text-slate-700 cursor-pointer shadow-sm">
      <option value="廁所">🚻 廁所</option>
      <option value="空間">🏢 空間</option>
      <option value="垃圾桶">🗑️ 垃圾桶</option>
    </select>
  );

  const thBtn = (field: SortField, label: string, center = false) => (
    <th onClick={() => handleSort(field)} className={`p-4 cursor-pointer hover:bg-slate-100/50 transition-colors group ${center ? 'w-24 text-center' : ''}`}>
      <div className={`flex items-center gap-1.5 ${center ? 'justify-center' : ''}`}>
        {label}
        <span className="text-[10px] text-slate-400 group-hover:text-slate-600 font-medium">{sortIcon(field)}</span>
      </div>
    </th>
  );

  return (
    <div>
      <h3 className="font-extrabold mb-6 flex items-center gap-2 text-slate-800 text-lg select-none">
        <Sparkles size={20} className="text-indigo-600" /> 公共空間管理
      </h3>

      {/* 新增表單 */}
      <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm max-w-2xl select-none">
        <h4 className="font-extrabold text-sm mb-3.5 text-slate-700 flex items-center gap-1.5">
          <span>➕</span> 新增據點公共空間
        </h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="例如：三樓走廊、副堂洗手間..." value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={async e => { if (e.key === 'Enter') { e.preventDefault(); await handleAdd(); } }}
            className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800 shadow-sm" />
          <div className="w-full sm:w-32 shrink-0">
            {catSelect(newCategory, setNewCategory)}
          </div>
          <input type="number" placeholder="排序" value={newSortOrder} onChange={e => setNewSortOrder(e.target.value)}
            className="w-full sm:w-20 p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-bold text-slate-800 shadow-sm" />
          <button onClick={handleAdd} disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 whitespace-nowrap">
            {submitting ? '新增中...' : '確認新增'}
          </button>
        </div>
      </div>

      {/* 清單 */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider border-b border-slate-200 select-none">
              {thBtn('name', '空間名稱')}
              {thBtn('category', '分類')}
              {thBtn('sort_order', '排序', true)}
              <th className="p-4">據點</th>
              <th className="p-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic bg-white rounded-b-2xl">目前此據點無設定 any 公共空間</td></tr>
            ) : (
              sorted.map((ps) => {
                const isEditing = editingId === ps.id;
                return (
                  <tr key={ps.id} className="hover:bg-slate-50/40 transition-colors bg-white">
                    <td className="p-4 font-extrabold text-slate-800 text-sm">
                      {isEditing ? <input className="p-2 border border-slate-200 rounded-xl text-xs w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-800" value={editName} onChange={e => setEditName(e.target.value)} /> : ps.name}
                    </td>
                    <td className="p-4">
                      {isEditing ? catSelect(editCategory, setEditCategory) : catBadge(ps.category)}
                    </td>
                    <td className="p-4 text-center">
                      {isEditing
                        ? <input type="number" className="p-2 border border-slate-200 rounded-xl text-xs w-20 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-800" value={editSortOrder} onChange={e => setEditSortOrder(e.target.value)} />
                        : <span className="text-slate-500 font-bold">{ps.sort_order || 0}</span>}
                    </td>
                    <td className="p-4">
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold select-none">{ps.branch}</span>
                    </td>
                    <td className="p-4 text-right">
                      {isEditing ? (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleDelete(ps.id, ps.name)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors border border-rose-200 active:scale-95 flex items-center gap-1">
                            <Trash2 size={12} /> 刪除
                          </button>
                          <button onClick={() => handleUpdate(ps.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm active:scale-95 flex items-center gap-1">
                            <Save size={12} /> 儲存
                          </button>
                          <button onClick={() => setEditingId(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors active:scale-95 flex items-center gap-1">
                            <X size={12} /> 取消
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(ps.id); setEditName(ps.name); setEditCategory(ps.category || '空間'); setEditSortOrder(String(ps.sort_order || 0)); }}
                          className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1">
                          <Edit size={12} /> 編輯
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

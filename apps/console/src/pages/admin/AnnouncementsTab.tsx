import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { apiCreateAnnouncement, apiUpdateAnnouncement, apiDeleteAnnouncement } from '@church/shared/api';
import type { Announcement } from '@church/shared/types';

interface AnnouncementsTabProps {
  data: Announcement[];
  getToken: () => string;
  onRefresh: () => void;
}

export default function AnnouncementsTab({ data, getToken, onRefresh }: AnnouncementsTabProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleStartEdit = (ann: Announcement) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setContent(ann.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
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
      setSelectedIds(data.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`確定要刪除這 ${selectedIds.length} 筆公告嗎？此動作無法復原。`)) return;
    
    setSubmitting(true);
    try {
      const results = await Promise.all(selectedIds.map(id => apiDeleteAnnouncement(getToken(), id)));
      const allOk = results.every(res => res.ok);
      if (allOk) {
        alert(`已成功刪除 ${selectedIds.length} 筆公告！`);
        setSelectedIds([]);
        onRefresh();
        if (editingId && selectedIds.includes(editingId)) {
          handleCancelEdit();
        }
      } else {
        alert('部分公告刪除失敗，請重新嘗試');
        onRefresh();
      }
    } catch {
      alert('網路錯誤，請稍後重試');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !title.trim() || !content.trim()) {
      if (!title.trim() || !content.trim()) alert('請填寫公告標題與內容');
      return;
    }
    setSubmitting(true);
    try {
      let res;
      if (editingId !== null) {
        res = await apiUpdateAnnouncement(getToken(), editingId, title.trim(), content.trim());
      } else {
        res = await apiCreateAnnouncement(getToken(), title.trim(), content.trim());
      }

      if (res.ok) {
        setTitle('');
        setContent('');
        setEditingId(null);
        onRefresh();
        alert(editingId !== null ? '公告更新成功！' : '公告發布成功！');
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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 發布/編輯表單 */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 max-w-2xl">
        <h4 className="font-bold text-base mb-4 text-slate-700">
          {editingId !== null ? '✏️ 編輯公告' : '📢 發布新公告'}
        </h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">公告標題</label>
            <input
              type="text"
              placeholder="例如：端午節連假場地開放時間異動..."
              required
              className="w-full p-3 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">公告內容</label>
            <textarea
              rows={4}
              placeholder="請輸入詳細公告內容..."
              required
              className="w-full p-3 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {submitting
                ? editingId !== null
                  ? '更新中...'
                  : '發布中...'
                : editingId !== null
                ? '確認更新公告'
                : '確認發布公告'}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="border border-slate-300 hover:bg-slate-100 text-slate-600 font-bold px-6 py-2.5 rounded-xl text-sm transition-all active:scale-95"
              >
                取消編輯
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 公告列表 */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <Megaphone size={20} className="text-indigo-600" /> 所有歷史公告
        </h3>

        {/* 全選與批次操作控制列 */}
        {data.length > 0 && (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-sm shadow-sm">
            <label className="flex items-center gap-2.5 font-bold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedIds.length === data.length && data.length > 0}
                onChange={e => handleToggleAll(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
              全選所有公告
            </label>
            {selectedIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
              >
                🗑️ 刪除所選公告 ({selectedIds.length})
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {data.length === 0 ? (
            <div className="p-8 text-center text-slate-400 italic bg-white border border-slate-100 rounded-2xl shadow-sm">
              目前無任何公告
            </div>
          ) : (
            data.map((a) => (
              <div
                key={a.id}
                className="flex gap-4 p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all items-start"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(a.id)}
                  onChange={e => handleToggleSelect(a.id, e.target.checked)}
                  className="w-4 h-4 mt-1.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="font-bold text-slate-800 text-base">{a.title}</div>
                      <button
                        onClick={() => handleStartEdit(a)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors cursor-pointer"
                      >
                        ✏️ 編輯
                      </button>
                    </div>
                    <div className="text-xs text-slate-400 font-medium bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full shrink-0">
                      📅{' '}
                      {new Date(a.created_at).toLocaleDateString('zh-TW', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {a.content}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

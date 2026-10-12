import { useState } from 'react';
import { DoorOpen, Users } from 'lucide-react';
import { BRANCHES } from '@church/shared/constants';
import { apiCreateRoom, apiUpdateRoom, apiDeleteRoom, apiBatchDeleteRooms } from '@church/shared/api';
import type { Room } from '@church/shared/types';

interface RoomsTabProps {
  data: Room[];
  currentBranch: string;
  getToken: () => string;
  onRefresh: () => void;
}

export default function RoomsTab({ data, currentBranch, getToken, onRefresh }: RoomsTabProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Room>>({});
  const [newForm, setNewForm] = useState<Partial<Room>>({ branch: currentBranch });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const handleAdd = async () => {
    const res = await apiCreateRoom(getToken(), { ...newForm, branch: newForm.branch || '仁愛堂' });
    if (res.ok) {
      setNewForm({ branch: currentBranch });
      onRefresh();
      alert('場地新增成功');
    } else {
      const err = await res.json();
      alert('失敗：' + err.error);
    }
  };

  const handleSave = async (id: number) => {
    const res = await apiUpdateRoom(getToken(), id, editForm);
    if (res.ok) {
      setEditingId(null);
      onRefresh();
    } else {
      const err = await res.json();
      alert('更新失敗：' + (err.error || '未知錯誤'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('確定要刪除此場地嗎？此動作將會一併移除該場地的預約與設定，且無法復原！')) return;
    const res = await apiDeleteRoom(getToken(), id);
    if (res.ok) {
      setSelectedIds(prev => prev.filter(item => item !== id));
      onRefresh();
      alert('場地刪除成功');
    } else {
      alert('刪除失敗');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`確定要批次刪除這 ${selectedIds.length} 個場地嗎？此動作將會一併移除這些場地的預約與設定，且無法復原！`)) return;
    const res = await apiBatchDeleteRooms(getToken(), selectedIds);
    if (res.ok) {
      setSelectedIds([]);
      onRefresh();
      alert('所選場地已成功批次刪除！');
    } else {
      const err = await res.json();
      alert('批次刪除失敗：' + (err.error || '未知錯誤'));
    }
  };

  return (
    <div>
      <h3 className="font-extrabold text-slate-800 text-lg mb-6 flex items-center gap-2 select-none">
        <DoorOpen className="text-indigo-600" size={20} /> 場地管理
      </h3>

      <div className="mb-8 max-w-2xl">
        {/* 新增表單 */}
        <div className="bg-slate-50/60 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-sm mb-4 text-slate-700 flex items-center gap-1.5 select-none">
              <span>➕</span> 新增據點場地
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="場地名稱"
                className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800 shadow-sm"
                value={newForm.name || ''}
                onChange={e => setNewForm({ ...newForm, name: e.target.value })}
              />
              <input
                type="number"
                placeholder="容納人數"
                className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-800 shadow-sm"
                value={newForm.capacity || ''}
                onChange={e => setNewForm({ ...newForm, capacity: parseInt(e.target.value) })}
              />
              <select
                className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-755 cursor-pointer shadow-sm"
                value={newForm.branch || '仁愛堂'}
                onChange={e => setNewForm({ ...newForm, branch: e.target.value })}
              >
                <option value="全">全 (跨據點)</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input
                type="text"
                placeholder="圖片網址"
                className="p-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 shadow-sm"
                value={newForm.image_url || ''}
                onChange={e => setNewForm({ ...newForm, image_url: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm active:scale-95 whitespace-nowrap self-end"
          >
            確認新增
          </button>
        </div>
      </div>

      {/* 批次管理控制區 */}
      {data.length > 0 && (
        <div className="mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm select-none">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={data.length > 0 && selectedIds.length === data.length}
              onChange={e => {
                if (e.target.checked) {
                  setSelectedIds(data.map(r => r.id));
                } else {
                  setSelectedIds([]);
                }
              }}
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-700">
              {selectedIds.length > 0 
                ? `已選取 ${selectedIds.length} / ${data.length} 個場地`
                : `全選所有場地 (${data.length})`
              }
            </span>
          </div>
          
          {selectedIds.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              🗑️ 批次刪除所選場地 ({selectedIds.length})
            </button>
          )}
        </div>
      )}

      {/* 場地清單卡片網格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((r) => {
          const isEditing = editingId === r.id;
          return (
            <div key={r.id} className={`border rounded-2xl p-5 shadow-sm transition-all duration-200 ${isEditing ? 'border-indigo-400 ring-2 ring-indigo-500/10 bg-white' : 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300'}`}>
              {isEditing ? (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">場地名稱</label>
                    <input className="border border-slate-300 p-2 text-xs w-full rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-bold text-slate-800" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">容納人數</label>
                      <input type="number" className="border border-slate-300 p-2 text-xs w-full rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-bold text-slate-800" value={editForm.capacity || ''} onChange={e => setEditForm({ ...editForm, capacity: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">據點</label>
                      <div className="text-xs font-bold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">{r.branch}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2.5 border-t border-slate-100 justify-end">
                    <button onClick={() => handleSave(r.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm active:scale-95">儲存</button>
                    <button onClick={() => setEditingId(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors active:scale-95">取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, r.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== r.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0"
                        />
                        <h4 className="font-extrabold text-slate-800 text-base">{r.name}</h4>
                      </div>
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0">{r.branch}</span>
                    </div>
                    
                    {r.image_url && (
                      <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/60 my-2">
                        <img src={r.image_url} alt={r.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}
                    
                    <p className="text-xs text-slate-500 leading-relaxed min-h-[32px] line-clamp-2">{r.description || '無描述'}</p>
                    
                    <div className="flex items-center gap-1.5 text-xs text-slate-655 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-100 shadow-sm">
                      <Users size={14} className="text-indigo-500" />
                      <span>容納人數:</span>
                      <span className="text-slate-800 font-bold">{r.capacity} 人</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
                    <button onClick={() => { setEditingId(r.id); setEditForm(r); }} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">編輯</button>
                    <button onClick={() => handleDelete(r.id)} className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">刪除</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

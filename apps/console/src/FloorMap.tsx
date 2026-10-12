import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Edit3, Save, Move } from 'lucide-react';
import { useAuth } from '@church/shared/auth';
import {
  apiFetchRooms,
  apiFetchBookingsByDate,
  apiFetchActiveBookingsNow,
  apiUpdateRoomPolygon,
} from '@church/shared/api';
import type { Booking, Room } from '@church/shared/types';
import { useEscapeKey } from './hooks/useEscapeKey';

export default function FloorMap({ 
  currentBranch, 
  onBack,
  isAdminMode = false 
}: { 
  currentBranch: string; 
  onBack?: () => void;
  isAdminMode?: boolean;
}) {
  const { role, getToken } = useAuth();
  const getTodayStr = () => {
    const now = new Date();
    return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }); // YYYY-MM-DD
  };

  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [dateBookings, setDateBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedRoomSchedule, setSelectedRoomSchedule] = useState<{ roomName: string, bookings: Booking[] } | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentFloor, setCurrentFloor] = useState('B1F');
  const [isEditMode, setIsEditMode] = useState(false);
  const [clickCoords, setClickCoords] = useState<{x: number, y: number}[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [draggingPolygon, setDraggingPolygon] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<{x: number, y: number} | null>(null);

  useEscapeKey(() => setSelectedRoomSchedule(null), !!selectedRoomSchedule);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editToolMode, setEditToolMode] = useState<'add' | 'move' | 'delete'>('add');
  const [isSavingMap, setIsSavingMap] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const promises = [
        apiFetchRooms(currentBranch),
        apiFetchBookingsByDate(selectedDate, currentBranch)
      ];
      
      const todayStr = getTodayStr();
      if (selectedDate === todayStr) {
        promises.push(apiFetchActiveBookingsNow(currentBranch));
      }
      
      const results = await Promise.all(promises);
      
      setRooms(results[0] || []);
      setDateBookings(results[1] || []);
      
      if (selectedDate === todayStr && results[2]) {
        setActiveBookings(results[2]);
      } else {
        setActiveBookings([]);
      }
    } catch (err) { console.error(err); }
  }, [currentBranch, selectedDate]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    if (!isEditMode) {
      setEditingRoomId(null);
      setClickCoords([]);
      setEditToolMode('add');
    }
  }, [isEditMode]);

  const handleSavePolygon = async () => {
    if (!editingRoomId) return alert('請先選擇要編輯的場地！');
    if (clickCoords.length < 3) return alert('場地範圍至少需要 3 個座標點！');
    
    setIsSavingMap(true);
    const polygonStr = `${currentFloor}:${clickCoords.map(c => `${c.x},${c.y}`).join(' ')}`;
    
    try {
      const res = await apiUpdateRoomPolygon(getToken(), editingRoomId, polygonStr);
      if (res.ok) {
        alert('儲存成功！');
        fetchData();
        setIsEditMode(false);
      } else {
        let errorMsg = `伺服器狀態碼 ${res.status}`;
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          if (res.status === 404) errorMsg = '後端尚未更新 (404 Not Found)，請務必重啟 backend 伺服器！';
        }
        alert(`儲存失敗: ${errorMsg}`);
      }
    } catch (err) {
      console.error(err);
      alert(`連線發生錯誤: ${err}`);
    } finally {
      setIsSavingMap(false);
    }
  };

  const occupiedRoomIds = activeBookings.map(b => b.room_id);

  const getOverlayStyle = (roomId: number) => {
    const isOccupied = occupiedRoomIds.includes(roomId);
    const hasBookingsToday = dateBookings.some(b => b.room_id === roomId);
    
    const isB1 = currentFloor === 'B1F';
    let fillColor = 'transparent';
    let fillOpacity = 0;
    let strokeColor = isB1 ? '#f97316' : '#3b82f6'; // Warm orange for B1F, Cool blue for B2F
    let strokeWidth = 2.5; // Thicker lines for better visibility
    let strokeDasharray = '0'; // Solid lines are much clearer

    if (isOccupied) {
      fillColor = '#10b981'; // Green for occupied rooms
      fillOpacity = 0.35;
      strokeColor = '#059669';
      strokeWidth = 4.5;
      strokeDasharray = '0';
    } else if (hasBookingsToday) {
      fillColor = isB1 ? '#ffedd5' : '#dbeafe'; // Light orange tint vs light blue tint
      fillOpacity = 0.3;
      strokeColor = isB1 ? '#ea580c' : '#2563eb';
      strokeWidth = 3.5;
      strokeDasharray = '4,4'; // Distinct dash line style for today's booked rooms
    } else {
      // Unoccupied/free today
      fillColor = isB1 ? '#fff7ed' : '#eff6ff'; // Very light orange tint vs blue tint
      fillOpacity = 0.15;
    }

    return {
      fill: fillColor,
      fillOpacity: fillOpacity,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      strokeDasharray: strokeDasharray,
      transition: 'all 0.3s ease',
      cursor: isEditMode ? 'default' : 'pointer',
      pointerEvents: isEditMode ? 'none' as const : 'auto' as const
    };
  };

  const getSvgCoords = useCallback((e: React.MouseEvent<Element> | React.TouchEvent<Element>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    try {
      const pt = svgRef.current.createSVGPoint();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      pt.x = clientX;
      pt.y = clientY;
      
      const ctm = svgRef.current.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const svgP = pt.matrixTransform(ctm.inverse());
      return { x: Math.round(svgP.x), y: Math.round(svgP.y) };
    } catch { return { x: 0, y: 0 }; }
  }, []);

  const handleSvgClick = (e: React.MouseEvent) => {
    if (!isEditMode || draggingIdx !== null || draggingPolygon || editToolMode !== 'add') return;
    const { x, y } = getSvgCoords(e);
    setClickCoords(prev => [...prev, { x, y }]);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, idx: number) => {
    e.stopPropagation();
    if (editToolMode === 'move') {
      setDraggingIdx(idx);
      setLastMousePos(getSvgCoords(e));
    }
  };

  const handlePolygonDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (editToolMode === 'move') {
      setDraggingPolygon(true);
      setLastMousePos(getSvgCoords(e));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<Element> | React.TouchEvent<Element>) => {
    if (!isEditMode) return;
    
    if (draggingIdx !== null && lastMousePos !== null) {
      const { x, y } = getSvgCoords(e);
      const dx = x - lastMousePos.x;
      const dy = y - lastMousePos.y;
      setClickCoords(prev => {
        const next = [...prev];
        next[draggingIdx] = { x: next[draggingIdx].x + dx, y: next[draggingIdx].y + dy };
        return next;
      });
      setLastMousePos({ x, y });
    } else if (draggingPolygon && lastMousePos !== null) {
      const { x, y } = getSvgCoords(e);
      const dx = x - lastMousePos.x;
      const dy = y - lastMousePos.y;
      setClickCoords(prev => prev.map(c => ({ x: c.x + dx, y: c.y + dy })));
      setLastMousePos({ x, y });
    }
  };

  const handleMouseUp = () => {
    // 延遲重設 draggingIdx，防止 click 事件立即觸發新增點
    setTimeout(() => {
      setDraggingIdx(null);
      setDraggingPolygon(false);
      setLastMousePos(null);
    }, 50);
  };

  return (
    <div className={`${onBack ? 'mt-8' : 'mt-0'} space-y-6`}>
      <div className="bg-white border border-slate-200 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 md:mb-8 gap-4 md:gap-6">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 select-none hover:scale-105 active:scale-95 duration-200"
              >
                ← 返回
              </button>
            )}
            <div>
              <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800">
                <Activity className="text-emerald-500 animate-pulse" size={28} />
                場地即時地圖
              </h2>
              <p className="text-slate-500 mt-2 font-medium">綠色為使用中，編輯模式下可手動描繪範圍</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {!isEditMode && (
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-2xl border border-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                <label htmlFor="floormap-date" className="text-xs font-black text-slate-500">查詢日期：</label>
                <input
                  id="floormap-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm font-black text-indigo-600 focus:outline-none border-none cursor-pointer"
                />
              </div>
            )}

            <div className="flex bg-slate-100 p-1.5 rounded-2xl select-none">
              <button
                onClick={() => { setCurrentFloor('B1F'); setClickCoords([]); }}
                className={`px-5 md:px-8 py-2 md:py-2.5 rounded-xl text-sm font-black transition-all duration-200 flex items-center gap-1.5 ${
                  currentFloor === 'B1F'
                    ? 'bg-orange-500 text-white shadow-md scale-105'
                    : 'text-slate-500 hover:text-orange-600 hover:bg-orange-50/50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${currentFloor === 'B1F' ? 'bg-white' : 'bg-orange-500'}`} />
                B1F
              </button>
              <button
                onClick={() => { setCurrentFloor('B2F'); setClickCoords([]); }}
                className={`px-5 md:px-8 py-2 md:py-2.5 rounded-xl text-sm font-black transition-all duration-200 flex items-center gap-1.5 ${
                  currentFloor === 'B2F'
                    ? 'bg-indigo-600 text-white shadow-md scale-105'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${currentFloor === 'B2F' ? 'bg-white' : 'bg-indigo-600'}`} />
                B2F
              </button>
            </div>

            {role === 'system_admin' && isAdminMode && (
              <button 
                onClick={() => { setIsEditMode(!isEditMode); setClickCoords([]); }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${isEditMode ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
              >
                {isEditMode ? <Save size={18} /> : <Edit3 size={18} />}
                {isEditMode ? '關閉編輯' : '開啟座標編輯器'}
              </button>
            )}
          </div>
        </div>

        {isEditMode && (
          <div className="bg-rose-50 border border-rose-100 p-4 md:p-5 rounded-2xl mb-6 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
             <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                   <div className="bg-rose-600 p-3 rounded-2xl text-white shadow-lg shadow-rose-200">
                      <Move size={24} className={draggingIdx !== null ? 'animate-spin' : ''} />
                   </div>
                   <div>
                      <div className="font-black text-rose-900 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-2">
                          選擇場地：
                          <select 
                            value={editingRoomId || ''} 
                            onChange={e => {
                              const newId = e.target.value ? Number(e.target.value) : null;
                              setEditingRoomId(newId);
                              if (newId) {
                                const room = rooms.find(r => r.id === newId);
                                if (room?.polygon_points) {
                                  const parts = room.polygon_points.split(':');
                                  if (parts.length === 2) {
                                    const floor = parts[0];
                                    if (floor !== currentFloor) setCurrentFloor(floor);
                                    const coords = parts[1].split(' ').filter((pt: string) => pt.trim()).map((pt: string) => {
                                      const [x, y] = pt.split(',');
                                      return { x: parseInt(x), y: parseInt(y) };
                                    });
                                    setClickCoords(coords);
                                  } else setClickCoords([]);
                                } else setClickCoords([]);
                              } else setClickCoords([]);
                            }}
                            className="px-2 py-1 rounded border border-rose-200 text-sm font-bold text-slate-700 bg-white"
                          >
                            <option value="">-- 請選擇 --</option>
                            {rooms.map(r => (
                              <option key={r.id} value={r.id}>{r.name} {r.polygon_points ? '✓' : ''}</option>
                            ))}
                          </select>
                        </div>
                        {editingRoomId && (
                          <div className="flex bg-rose-200/50 p-1 rounded-lg">
                            <button onClick={() => setEditToolMode('add')} className={`px-3 py-1 text-xs font-bold rounded ${editToolMode === 'add' ? 'bg-rose-500 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-200'}`}>新增</button>
                            <button onClick={() => setEditToolMode('move')} className={`px-3 py-1 text-xs font-bold rounded ${editToolMode === 'move' ? 'bg-rose-500 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-200'}`}>移動</button>
                            <button onClick={() => setEditToolMode('delete')} className={`px-3 py-1 text-xs font-bold rounded ${editToolMode === 'delete' ? 'bg-rose-500 text-white shadow-sm' : 'text-rose-700 hover:bg-rose-200'}`}>刪除</button>
                          </div>
                        )}
                      </div>
                      <div className="text-rose-700 text-xs mt-2 font-medium">
                        {editToolMode === 'add' && "👉 點擊地圖新增新的座標點"}
                        {editToolMode === 'move' && "👉 按住紅點拖曳來移動位置"}
                        {editToolMode === 'delete' && "👉 點擊紅點即可刪除該座標"}
                        {!editingRoomId && "請先選擇要編輯的場地"}
                      </div>
                   </div>
                </div>

                <div className="flex gap-2">
                   <button onClick={() => setClickCoords([])} className="px-4 py-2 bg-rose-100 border border-rose-200 rounded-lg md:rounded-xl text-xs font-bold text-rose-800 hover:bg-rose-200 transition-colors shadow-sm">
                      重設座標
                   </button>
                   <button onClick={handleSavePolygon} disabled={isSavingMap} className="px-6 py-2 bg-indigo-600 border border-indigo-700 rounded-lg md:rounded-xl text-sm font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50">
                      <Save size={16} /> {isSavingMap ? '儲存中...' : '儲存此場地座標'}
                   </button>
                </div>
             </div>
          </div>
        )}

        <div className="relative border-[12px] border-slate-900 rounded-2xl overflow-hidden bg-slate-200 mx-auto max-w-4xl shadow-2xl">
          <img 
            src={`/maps/${currentFloor.toLowerCase()}.png`} 
            alt="Floor Map" 
            className={`w-full h-auto block select-none pointer-events-none ${isEditMode ? 'opacity-60' : 'opacity-100'}`}
          />

          <svg 
            ref={svgRef}
            viewBox="0 0 1000 1000" 
            className={`absolute inset-0 w-full h-full ${isEditMode ? 'cursor-crosshair z-30' : 'pointer-events-none z-10'}`}
            onClick={handleSvgClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            {/* 動態渲染場地圖層 */}
            {rooms.map(room => {
              if (!room.polygon_points) return null;
              const parts = room.polygon_points.split(':');
              if (parts.length !== 2 || parts[0] !== currentFloor) return null;
              if (isEditMode && editingRoomId === room.id) return null;
              
              const roomBookings = dateBookings.filter(b => b.room_id === room.id);
              const tooltipText = `${room.name}${roomBookings.length > 0 ? '\n\n本日預約排程：\n' + roomBookings.map(b => `• ${b.start_time.substring(0, 5)}-${b.end_time.substring(0, 5)} ${b.pastoral_zone || ''} ${b.purpose || ''}${b.status === 'pending' ? ' (待審核)' : ''}`).join('\n') : '\n\n本日無預約'}`;

              return (
                <g key={room.id}>
                  <polygon 
                    points={parts[1]} 
                    {...getOverlayStyle(room.id)} 
                    onClick={() => {
                      if (!isEditMode) {
                        setSelectedRoomSchedule({
                          roomName: room.name,
                          bookings: roomBookings
                        });
                      }
                    }}
                    className={!isEditMode ? 'hover:opacity-85 transition-all duration-200' : ''}
                  />
                  <title>{tooltipText}</title>
                </g>
              );
            })}

            {/* 編輯預覽區域 */}
            {isEditMode && clickCoords.length > 0 && (
              <polygon 
                points={clickCoords.map(c => `${c.x},${c.y}`).join(' ')} 
                fill="rgba(244, 63, 94, 0.25)" 
                stroke="#f43f5e" 
                strokeWidth="4" 
                strokeDasharray="8,8"
                className={`transition-all ${editToolMode === 'move' ? 'cursor-grab hover:fill-rose-500/40' : ''} ${editToolMode === 'delete' ? 'cursor-pointer hover:fill-red-700/50' : ''} ${draggingPolygon ? 'cursor-grabbing fill-rose-500/50' : ''}`}
                style={{ pointerEvents: editToolMode !== 'add' ? 'auto' : 'none' }}
                onMouseDown={handlePolygonDragStart}
                onTouchStart={handlePolygonDragStart}
                onClick={(e) => {
                  e.stopPropagation();
                  if (editToolMode === 'delete') {
                    if (window.confirm('確定要刪除整個場地範圍嗎？')) {
                      setClickCoords([]);
                    }
                  }
                }}
              />
            )}

            {/* 可操作的編輯點 */}
            {isEditMode && clickCoords.map((c, i) => (
              <circle 
                key={i} 
                cx={c.x} cy={c.y} r={draggingIdx === i ? "16" : "12"} 
                fill="#f43f5e" 
                stroke="white" 
                strokeWidth="3" 
                className={`transition-colors duration-200 ${editToolMode === 'move' ? (draggingIdx === i ? 'cursor-grabbing fill-rose-400' : 'cursor-grab hover:fill-rose-400') : ''} ${editToolMode === 'delete' ? 'cursor-pointer hover:fill-red-700' : ''}`}
                onMouseDown={(e) => handleDragStart(e, i)}
                onTouchStart={(e) => handleDragStart(e, i)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (editToolMode === 'delete') {
                    setClickCoords(prev => prev.filter((_, idx) => idx !== i));
                  }
                }}
              />
            ))}
          </svg>

          {/* 圖例 */}
          <div className="absolute top-2 right-2 md:top-6 md:right-6 bg-white/90 backdrop-blur p-2 md:p-4 rounded-xl md:rounded-2xl shadow-lg md:shadow-2xl border border-slate-200 z-20 pointer-events-auto">
             {selectedDate === getTodayStr() && (
               <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                  <div className="w-4 h-4 rounded shadow-sm bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-emerald-800">當下使用中</span>
               </div>
             )}
             <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                <div className="w-4 h-4 rounded shadow-sm bg-amber-500"></div>
                <span className="text-[10px] font-black text-amber-800">當日有預約</span>
             </div>
             <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded shadow-sm bg-white border-2 border-slate-300"></div>
                <span className="text-[10px] font-black text-slate-500">當日無預約</span>
             </div>
          </div>
        </div>
      </div>

      {/* 預約排程彈出視窗 (Modal) */}
      {selectedRoomSchedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-label={`${selectedRoomSchedule.roomName} 預約日程`} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">{selectedRoomSchedule.roomName}</h3>
                <p className="text-xs font-medium text-slate-500">{selectedDate} 預約日程</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoomSchedule(null)}
                aria-label="關閉視窗"
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {selectedRoomSchedule.bookings.length > 0 ? (
                selectedRoomSchedule.bookings
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map(b => (
                    <div key={b.id} className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl flex flex-col gap-1 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                          {b.start_time.substring(0, 5)} - {b.end_time.substring(0, 5)}
                        </span>
                        <span className={`text-[10px] font-black ${b.status === 'approved' ? 'text-slate-400' : 'text-amber-500 font-bold animate-pulse'}`}>
                          {b.status === 'approved' ? '已核准' : '待審核'}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-800 mt-1 flex flex-col gap-0.5">
                        <span className="text-xs text-indigo-600/90 font-semibold">{b.pastoral_zone || '無牧區'}</span>
                        <span className="text-sm whitespace-pre-wrap break-all">{b.purpose || '無性質'}</span>
                      </h4>
                    </div>
                  ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 italic">
                  <span className="text-3xl mb-2">🍃</span>
                  當日無任何預約紀錄
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <button 
                onClick={() => setSelectedRoomSchedule(null)}
                className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-lg"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

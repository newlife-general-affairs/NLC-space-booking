import { useState, useEffect, Fragment } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../auth';
import { apiFetchRooms, apiFetchWeeklyBookings, apiUpdateBooking, apiCancelBooking, apiUpdateBookingStatus } from '../api';

interface WeeklyBooking {
  id: number;
  room_id: number;
  rooms: { name: string };
  user_email: string;
  full_name: string;
  pastoral_zone: string;
  purpose: string;
  booking_type: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  attendance_count: number;
  status: string;
  isConflictPlaceholder?: boolean;
  conflictRoomName?: string;
}

interface Room {
  id: number;
  name: string;
  parent_room_id?: number | null;
}

export default function WeeklyBulletin({
  currentBranch,
  isAdmin = false,
  onStartBooking,
  onBack,
  showSpecialEvents = false,
}: {
  currentBranch: string;
  isAdmin?: boolean;
  onStartBooking?: (date?: string, roomId?: number) => void;
  onBack?: () => void;
  // 在看板上方列出本週婚禮／重要活動，並在手機版日期上標示
  showSpecialEvents?: boolean;
}) {
  const { getToken } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<WeeklyBooking[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isOrderingModalOpen, setIsOrderingModalOpen] = useState(false);
  const [tempRoomsOrder, setTempRoomsOrder] = useState<Room[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedEditBooking, setSelectedEditBooking] = useState<WeeklyBooking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    pastoral_zone: string;
    purpose: string;
    attendance_count: number;
    booking_date: string;
    start_time: string;
    end_time: string;
    room_id: number;
  }>({
    pastoral_zone: '',
    purpose: '',
    attendance_count: 0,
    booking_date: '',
    start_time: '',
    end_time: '',
    room_id: 0
  });

  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const isBookingPast = (dateStr: string, endTimeStr: string) => {
    try {
      const now = new Date();
      const [hours, minutes] = endTimeStr.split(':').map(Number);

      let targetDateStr = dateStr;
      if (hours === 0 && minutes === 0) {
        const nextDay = new Date(dateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        targetDateStr = nextDay.toISOString().split('T')[0];
      }

      const bookingEnd = new Date(
        `${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
      );
      return now > bookingEnd;
    } catch {
      return false;
    }
  };

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const handleSaveEdit = async () => {
    if (!selectedEditBooking) return;
    const countVal = Number(editForm.attendance_count);
    if (isNaN(countVal) || countVal <= 0) {
      alert('❌ 預計人數必須大於 0！');
      return;
    }
    try {
      const res = await apiUpdateBooking(getToken() || '', selectedEditBooking.id, {
        pastoral_zone: editForm.pastoral_zone,
        purpose: editForm.purpose,
        attendance_count: countVal,
        booking_date: editForm.booking_date,
        start_time: editForm.start_time.length === 5 ? `${editForm.start_time}:00` : editForm.start_time,
        end_time: editForm.end_time.length === 5 ? `${editForm.end_time}:00` : editForm.end_time,
        room_id: Number(editForm.room_id)
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        setSelectedEditBooking(null);
        triggerRefresh();
        alert('修改成功！');
      } else {
        const err = await res.json();
        alert('修改失敗：' + (err.error || '未知錯誤'));
      }
    } catch (e) {
      console.error(e);
      alert('發生錯誤，請稍後再試');
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedEditBooking) return;
    if (!window.confirm('確定要取消此筆場地預約嗎？')) return;
    try {
      const res = await apiCancelBooking(getToken() || '', selectedEditBooking.id);
      if (res.ok) {
        setIsEditModalOpen(false);
        setSelectedEditBooking(null);
        triggerRefresh();
        alert('預約已成功取消！');
      } else {
        const err = await res.json();
        alert('取消失敗：' + (err.error || '未知錯誤'));
      }
    } catch (e) {
      console.error(e);
      alert('發生錯誤，請稍後再試');
    }
  };

  // 已核可的預約要改場地前，需先退回待審核（與衝突拖曳看板同規則）
  const handleRevertToPending = async () => {
    if (!selectedEditBooking) return;
    if (
      !window.confirm(
        `確定將「${selectedEditBooking.full_name}」退回待審核？\n若已發放門鎖密碼將一併清除，重新核可後需再發送。`
      )
    )
      return;
    try {
      const res = await apiUpdateBookingStatus(getToken() || '', selectedEditBooking.id, 'pending');
      if (res.ok) {
        setIsEditModalOpen(false);
        setSelectedEditBooking(null);
        triggerRefresh();
        alert('已退回待審核，現在可調整場地。');
      } else {
        const err = await res.json();
        alert('退回失敗：' + (err.error || '未知錯誤'));
      }
    } catch (e) {
      console.error(e);
      alert('發生錯誤，請稍後再試');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const weekDays = getWeekDays(currentDate);
        const start = formatDate(weekDays[0]);
        const end = formatDate(weekDays[6]);

        const [rawRooms, rawBookings] = await Promise.all([
          apiFetchRooms(currentBranch),
          apiFetchWeeklyBookings(start, end, currentBranch, getToken() || undefined),
        ]);

        const filteredRooms = Array.isArray(rawRooms)
          ? rawRooms.filter(r => r.name !== '💒 由教會分配' && !r.name.includes('由教會分配'))
          : [];

        // Apply custom room ordering if present in localStorage
        const storedOrder = localStorage.getItem(`room_order_${currentBranch}`);
        let sortedRooms = filteredRooms;
        if (storedOrder) {
          try {
            const orderIds = JSON.parse(storedOrder) as number[];
            const orderMap = new Map<number, number>();
            orderIds.forEach((id, index) => {
              orderMap.set(id, index);
            });
            
            sortedRooms = [...filteredRooms].sort((a, b) => {
              const aIndex = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
              const bIndex = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
              if (aIndex !== bIndex) {
                return aIndex - bIndex;
              }
              return a.id - b.id;
            });
          } catch (e) {
            console.error('Failed to parse room order from localStorage', e);
          }
        }

        setRooms(sortedRooms);
        setBookings(
          Array.isArray(rawBookings)
            ? rawBookings.filter(
                b =>
                  b.rooms &&
                  b.rooms.name !== '💒 由教會分配' &&
                  !b.rooms.name.includes('由教會分配')
              )
            : []
        );
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };
    fetchData();
}, [currentDate, currentBranch, refreshKey, getToken]);

  const weekDays = getWeekDays(currentDate);
  const [mobileDayIdx, setMobileDayIdx] = useState(() => {
    const idx = weekDays.findIndex(d => formatDate(d) === formatDate(new Date()));
    return idx >= 0 ? idx : 0;
  });

  // 同一天、同類型、同用途的多筆借用視為同一個活動
  const specialEvents: { key: string; date: string; type: string; title: string; rooms: string[]; start: string; end: string }[] = [];
  if (showSpecialEvents) {
    bookings
      .filter(b => b.booking_type === '婚禮' || b.booking_type === '重要')
      .forEach(b => {
        const key = `${b.booking_date}::${b.booking_type}::${b.purpose}`;
        const existing = specialEvents.find(e => e.key === key);
        const roomName = b.rooms.name;
        if (existing) {
          if (!existing.rooms.includes(roomName)) existing.rooms.push(roomName);
          if (b.start_time < existing.start) existing.start = b.start_time;
          if (b.end_time > existing.end) existing.end = b.end_time;
        } else {
          specialEvents.push({ key, date: b.booking_date, type: b.booking_type, title: b.purpose, rooms: [roomName], start: b.start_time, end: b.end_time });
        }
      });
    specialEvents.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  }
  const specialEventDates = new Set(specialEvents.map(e => e.date));

  // 1. 找出所有的 Parent Room IDs
  const parentIds = new Set<number>();
  rooms.forEach(r => {
    if (r.parent_room_id) {
      parentIds.add(r.parent_room_id);
    }
  });

  // 2. 建立 Parent ID -> Parent Room 的 Map
  const parentMap: { [key: number]: Room } = {};
  rooms.forEach(r => {
    if (parentIds.has(r.id)) {
      parentMap[r.id] = r;
    }
  });

  // 3. 找出所有 Children
  const childrenMap: { [key: number]: Room[] } = {};
  const childIds = new Set<number>();
  rooms.forEach(r => {
    if (r.parent_room_id) {
      childIds.add(r.id);
      if (!childrenMap[r.parent_room_id]) {
        childrenMap[r.parent_room_id] = [];
      }
      childrenMap[r.parent_room_id].push(r);
    }
  });

  // 4. 重構 Columns 與 Groups 列表
  const groups: { parent: Room | null; children: Room[] }[] = [];
  const processedParentIds = new Set<number>();

  rooms.forEach(r => {
    if (parentIds.has(r.id)) {
      if (!processedParentIds.has(r.id)) {
        processedParentIds.add(r.id);
        const groupChildren = childrenMap[r.id] || [];
        if (groupChildren.length > 0) {
          groups.push({
            parent: r,
            children: groupChildren
          });
        }
      }
    } else if (childIds.has(r.id)) {
      const parentId = r.parent_room_id;
      if (parentId && !processedParentIds.has(parentId)) {
        processedParentIds.add(parentId);
        const parentObj = parentMap[parentId] || { id: parentId, name: r.name.split('-')[0] };
        const groupChildren = childrenMap[parentId] || [r];
        groups.push({
          parent: parentObj,
          children: groupChildren
        });
      }
    } else {
      groups.push({
        parent: null,
        children: [r]
      });
    }
  });

  // 5. 展平得到實際的葉子欄位
  const leafColumns: Room[] = [];
  groups.forEach(g => {
    leafColumns.push(...g.children);
  });

  const getRoomBgClass = (name: string) => {
    const nameUpper = name.toUpperCase();
    const isB1 = nameUpper.includes('B1');
    const isB2 = nameUpper.includes('B2');
    if (isB1) return "bg-orange-100/70 text-orange-950 border-r border-slate-300";
    if (isB2) return "bg-indigo-100/70 text-indigo-950 border-r border-slate-300";
    return "bg-slate-50 text-slate-700 border-r border-slate-300";
  };

  const getBookingsForTimeAndRoom = (
    dayBookings: WeeklyBooking[],
    roomId: number,
    tp: string,
    isWeekday: boolean
  ) => {
    return dayBookings.filter(b => {
      if (b.room_id !== roomId) return false;
      const startTime = b.start_time.substring(0, 5);
      if (isWeekday) {
        if (tp === '晨') return startTime < '08:00';
        if (tp === '上午') return startTime >= '08:00' && startTime < '12:00';
        if (tp === '下午') return startTime >= '12:00' && startTime < '17:00';
        return startTime >= '17:00';
      } else {
        if (tp === '晨') return startTime < '08:00';
        if (tp === '08:00 - 12:00') return startTime >= '08:00' && startTime < '12:00';
        if (tp === '12:00 - 15:00') return startTime >= '12:00' && startTime < '15:00';
        if (tp === '15:00 - 18:00') return startTime >= '15:00' && startTime < '18:00';
        return startTime >= '18:00';
      }
    });
  };

  const renderBookingCard = (b: WeeklyBooking) => {
    const isPast = isBookingPast(b.booking_date, b.end_time);
    const isApproved = b.status === 'approved';

    if (b.isConflictPlaceholder) {
      return (
        <div
          key={`conflict-${b.id}`}
          className="p-2 rounded-lg border border-slate-200 bg-slate-50/80 text-left shadow-sm opacity-70 text-slate-400 select-none text-[11px] leading-tight"
          title={`此時段「${b.conflictRoomName}」已被預約，故本空間自動鎖定`}
        >
          <div className="text-[9px] font-mono font-bold text-slate-400 mb-0.5">
            {b.start_time.substring(0, 5)} - {b.end_time.substring(0, 5)}
          </div>
          <div className="font-bold text-slate-500 flex items-center gap-1">
            <span>🔒</span>
            <span>「{b.conflictRoomName}」已被借用</span>
          </div>
          <div className="text-[9px] text-slate-400 mt-1 truncate">
            事由：{b.purpose}
          </div>
        </div>
      );
    }

    return (
      <div
        key={b.id}
        onClick={e => {
          e.stopPropagation();
          if (isAdmin && !isPast) {
            setSelectedEditBooking(b);
            setEditForm({
              pastoral_zone: b.pastoral_zone || '',
              purpose: b.purpose || '',
              attendance_count: b.attendance_count || 0,
              booking_date: b.booking_date,
              start_time: b.start_time.substring(0, 5),
              end_time: b.end_time.substring(0, 5),
              room_id: b.room_id
            });
            setIsEditModalOpen(true);
          }
        }}
        className={`p-2 rounded-lg border text-left shadow-sm group relative transition-all duration-200 ${
          isAdmin && !isPast ? 'cursor-pointer hover:border-indigo-400 hover:ring-1 hover:ring-indigo-400 hover:shadow-md' : ''
        } ${
          isPast
            ? 'bg-slate-100 border-slate-300 text-slate-400 opacity-60'
            : isApproved
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50/60 border-amber-300/80 border-dashed text-amber-900 opacity-90 hover:opacity-100 hover:bg-amber-50'
        }`}
        title={
          isAdmin && !isPast
            ? isApproved
              ? "管理端：已核可，點擊可退回待審核或修改細節（場地已鎖定）"
              : "管理端：點擊修改或取消此排程"
            : undefined
        }
      >
        {!isApproved && !isPast && (
          <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm font-bold animate-pulse">
            待審核
          </div>
        )}
        {isAdmin && isApproved && !isPast && (
          <div className="absolute -top-2 -right-2 bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm font-bold flex items-center gap-0.5">
            🔒 已核可
          </div>
        )}
        {isPast && (
          <div className="absolute -top-2 -right-2 bg-slate-400 text-white text-[9px] px-1.5 py-0.5 rounded-full shadow-sm font-bold">
            已過期
          </div>
        )}
        <div className="flex items-center justify-between mb-1">
          <div
            className={`text-[9px] font-mono font-bold ${
              isPast ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {b.start_time.substring(0, 5)} - {b.end_time.substring(0, 5)}
          </div>
        </div>
        <div
          className={`text-xs font-bold leading-tight mb-1 ${
            isPast
              ? 'text-slate-400 line-through'
              : isApproved
              ? 'text-emerald-900'
              : 'text-amber-950'
          }`}
        >
          {b.pastoral_zone && (
            <div className={`text-[10px] font-semibold mb-0.5 ${
              isPast
                ? 'text-slate-400'
                : isApproved
                ? 'text-indigo-600/90'
                : 'text-amber-700'
            }`}>
              {b.pastoral_zone}
            </div>
          )}
          <div className="whitespace-pre-wrap break-all">{b.purpose}</div>
        </div>
        <div
          className={`text-[9px] ${
            isPast
              ? 'text-slate-400'
              : isApproved
              ? 'text-slate-500'
              : 'text-amber-800/80'
          } font-medium`}
        >
          預估：{b.attendance_count} 人
        </div>
      </div>
    );
  };

  const formatRoomName = (name: string) => {
    if (name.includes('互動區')) {
      const idx = name.indexOf('互動區') + 3;
      const part1 = name.substring(0, idx);
      const part2 = name.substring(idx);
      return (
        <div className="leading-tight">
          <span className="whitespace-nowrap">{part1}</span>
          <br />
          <span className="whitespace-nowrap">{part2}</span>
        </div>
      );
    }
    return <span className="whitespace-nowrap">{name}</span>;
  };

  return (
    <div className={`bg-white border border-slate-300 rounded-2xl overflow-hidden shadow-md ${onBack ? 'mt-8' : 'mt-0'}`}>
      <div className="p-4 md:p-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-indigo-50/50">
        <div className="flex items-center gap-3 shrink-0">
          {onBack && (
            <button
              onClick={onBack}
              className="shrink-0 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 select-none hover:scale-105 active:scale-95 duration-200"
            >
              ← 返回
            </button>
          )}
          <h2 className="text-lg md:text-xl font-black flex items-start gap-2 text-indigo-900 leading-tight">
            <CalendarIcon className="text-indigo-600 shrink-0 mt-0.5" size={20} />
            <div className="flex flex-col">
              <span className="text-[10px] md:text-xs font-black text-indigo-500/80 tracking-wider uppercase">{currentBranch}</span>
              <span className="text-base md:text-lg font-black whitespace-nowrap">場地預約看板</span>
            </div>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-start sm:justify-end w-full sm:w-auto">
          {onStartBooking && (
            <button
              onClick={() => onStartBooking()}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
            >
              📅 預約場地
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => {
                setTempRoomsOrder([...rooms]);
                setIsOrderingModalOpen(true);
              }}
              className="shrink-0 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 select-none hover:scale-105 duration-200"
            >
              ⚙️ 調整欄位順序
            </button>
          )}
          
          {/* 表格縮放控制區（僅桌機表格檢視需要） */}
          <div className="hidden md:flex shrink-0 items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm select-none">
            <button
              onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-xs font-bold text-slate-500 hover:text-indigo-600 active:scale-95"
              title="縮小表格"
              data-no-debounce="true"
            >
              🔍 縮小
            </button>
            <span className="text-xs font-bold text-slate-700 min-w-[45px] text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-xs font-bold text-slate-500 hover:text-indigo-600 active:scale-95"
              title="放大表格"
              data-no-debounce="true"
            >
              放大
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="p-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 border-l border-slate-200 pl-2 transition-colors active:scale-95"
              data-no-debounce="true"
            >
              重設
            </button>
          </div>

          <div className="shrink-0 flex items-center gap-2.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() - 7);
                setCurrentDate(d);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              data-no-debounce="true"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs md:text-sm font-bold text-slate-700 min-w-[130px] md:min-w-[150px] text-center select-none whitespace-nowrap">
              {weekDays[0].toLocaleDateString()} - {weekDays[6].toLocaleDateString()}
            </span>
            <button
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + 7);
                setCurrentDate(d);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              data-no-debounce="true"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {showSpecialEvents && (
        <div className="px-4 md:px-6 py-3 border-b border-slate-200 bg-amber-50/40">
          <div className="text-xs font-black text-slate-600 mb-2">✨ 本週婚禮與重要活動</div>
          {specialEvents.length === 0 ? (
            <div className="text-xs text-slate-400 font-medium">本週沒有婚禮或重要活動</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {specialEvents.map(ev => {
                const idx = weekDays.findIndex(d => formatDate(d) === ev.date);
                return (
                  <button
                    key={ev.key}
                    type="button"
                    onClick={() => { if (idx >= 0) setMobileDayIdx(idx); }}
                    className="flex items-start gap-2 text-left text-xs"
                  >
                    <span className={`shrink-0 px-2 py-0.5 rounded-full font-black text-[10px] ${ev.type === '婚禮' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                      {ev.type}
                    </span>
                    <span className="min-w-0">
                      <span className="font-bold text-slate-700">
                        {ev.date.substring(5).replace('-', '/')}（{['一', '二', '三', '四', '五', '六', '日'][idx] ?? ''}）{ev.start.substring(0, 5)}-{ev.end.substring(0, 5)} {ev.title}
                      </span>
                      <span className="block text-[11px] text-slate-400">{ev.rooms.join('、')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 手機版：單日清單檢視 */}
      <div className="md:hidden">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hidden px-3 py-3 border-b border-slate-200">
          {weekDays.map((day, idx) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const isSelected = idx === mobileDayIdx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setMobileDayIdx(idx)}
                className={`shrink-0 w-12 py-2 rounded-xl flex flex-col items-center gap-0.5 font-bold transition-colors ${
                  isSelected ? 'bg-indigo-600 text-white' : isToday ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500'
                }`}
              >
                <span className="text-[10px]">{['一', '二', '三', '四', '五', '六', '日'][idx]}</span>
                <span className="text-sm">{day.getDate()}</span>
                {showSpecialEvents && (
                  <span className={`w-1.5 h-1.5 rounded-full ${specialEventDates.has(formatDate(day)) ? (isSelected ? 'bg-white' : 'bg-rose-500') : 'bg-transparent'}`} />
                )}
              </button>
            );
          })}
        </div>

        {(() => {
          const day = weekDays[mobileDayIdx];
          const dayStr = formatDate(day);
          const dayBookings = bookings
            .filter(b => b.booking_date === dayStr && !b.purpose.includes('大掃除'))
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          const roomsWithBookings = leafColumns.filter(room => dayBookings.some(b => b.room_id === room.id));

          if (roomsWithBookings.length === 0) {
            return (
              <div className="py-12 text-center text-sm text-slate-400 font-medium">
                本日尚無任何場地借用
              </div>
            );
          }

          return (
            <div className="p-3 space-y-4">
              {roomsWithBookings.map(room => (
                <div key={room.id}>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 pl-1">{formatRoomName(room.name)}</h4>
                  <div className="flex flex-col gap-2">
                    {dayBookings.filter(b => b.room_id === room.id).map(b => renderBookingCard(b))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* 桌機版：試算表滾動視圖 (Spreadsheet Style Grid View) */}
      <div className="hidden md:block overflow-auto max-h-[75dvh] relative">
        <table className="w-full border-collapse text-sm table-auto min-w-[1100px]" style={{ zoom: zoomLevel / 100 }}>
          <thead>
            <tr className="bg-slate-50">
              {/* 左上角交界格：雙重固定 */}
              <th rowSpan={2} className="p-0 border-b border-slate-300 border-r border-slate-300 text-left font-bold text-slate-600 sticky left-0 top-0 bg-slate-100 z-30 w-12 min-w-[48px] max-w-[48px] shadow-[2px_2px_5px_rgba(0,0,0,0.06)] select-none whitespace-nowrap">
                <div className="py-2 px-1 flex flex-col items-center justify-center leading-tight text-[11px] w-12 min-w-[48px] max-w-[48px]">
                  <span>日</span>
                  <span>期</span>
                </div>
              </th>
              <th rowSpan={2} className="p-0 border-b border-slate-300 border-r border-slate-300 text-left font-bold text-slate-600 sticky left-12 top-0 bg-slate-100 z-30 w-10 min-w-[40px] max-w-[40px] shadow-[2px_2px_5px_rgba(0,0,0,0.06)] select-none whitespace-nowrap">
                <div className="py-2 px-1 flex flex-col items-center justify-center leading-tight text-[11px] w-10 min-w-[40px] max-w-[40px]">
                  <span>時</span>
                  <span>間</span>
                </div>
              </th>
              {/* 表頭場地名稱：獨立場地(跨2行)或合併父場地 */}
              {groups.map(group => {
                if (group.parent === null) {
                  const room = group.children[0];
                  return (
                    <th
                      key={room.id}
                      rowSpan={2}
                      className={`py-2.5 px-2 text-center font-bold sticky top-0 z-20 min-w-[130px] shadow-[0_2px_4px_rgba(0,0,0,0.02)] select-none ${getRoomBgClass(room.name)}`}
                    >
                      {formatRoomName(room.name)}
                    </th>
                  );
                } else {
                  const parentRoom = group.parent;
                  return (
                    <th
                      key={parentRoom.id}
                      colSpan={group.children.length}
                      className={`py-2 px-2 text-center font-bold sticky top-0 z-20 select-none border-b border-slate-300 ${getRoomBgClass(parentRoom.name)}`}
                    >
                      {formatRoomName(parentRoom.name)}
                    </th>
                  );
                }
              })}
            </tr>
            {/* 第二列：子場地名稱 */}
            <tr className="bg-slate-50">
              {groups.map(group => {
                if (group.parent === null) return null;
                return group.children.map(child => {
                  const displayName = child.name.includes('-')
                    ? child.name.split('-').pop() || child.name
                    : child.name;
                  return (
                    <th
                      key={child.id}
                      className={`py-1.5 px-2 text-center text-xs font-bold border-b border-slate-300 sticky top-[36px] z-20 select-none ${getRoomBgClass(child.name)}`}
                    >
                      {displayName}
                    </th>
                  );
                });
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 bg-white">
            {weekDays.map((day, dayIdx) => {
              const dayStr = formatDate(day);
              const isToday = day.toDateString() === new Date().toDateString();

              // Get all bookings for this day
              const dayBookings = bookings.filter(b => b.booking_date === dayStr);

              // Find if there is a cleanup booking (e.g. purpose contains "大掃除")
              const cleanupBooking = dayBookings.find(b => b.purpose.includes('大掃除'));

              // Bookings excluding cleanup
              const dailyBookings = dayBookings.filter(b => !b.purpose.includes('大掃除'));

              const isWeekday = dayIdx <= 4;
              let bookingRowsToRender: string[];
              if (isWeekday) {
                bookingRowsToRender = ['晨', '上午', '下午', '晚上'];
              } else {
                bookingRowsToRender = ['晨', '08:00 - 12:00', '12:00 - 15:00', '15:00 - 18:00', '18:00 ~'];
              }

              const hasCleanup = !!cleanupBooking;
              const totalRows = bookingRowsToRender.length + (hasCleanup ? 1 : 0);

              const todayStr = formatDate(new Date());
              const isClickable = dayStr >= todayStr;

              return (
                <Fragment key={dayIdx}>
                  {bookingRowsToRender.map((tp, tpIdx) => {
                    const isFirstRowOfDay = tpIdx === 0;
                    const isLastRow = tpIdx === bookingRowsToRender.length - 1 && !cleanupBooking;
                    let borderClass = 'border-b border-slate-200';
                    if (isLastRow) {
                      borderClass = 'border-b-2 border-slate-300';
                    } else if (!isWeekday) {
                      borderClass = 'border-b border-red-300/80';
                    }

                    return (
                      <tr
                        key={tp || 'empty'}
                        className={`hover:bg-slate-50/40 transition-colors ${
                          isToday ? 'bg-indigo-50/10' : ''
                        } ${borderClass}`}
                      >
                        {/* 1. 左側日期欄：只在當天的第一行渲染，並跨所有子列 */}
                        {isFirstRowOfDay && (
                          <td
                            rowSpan={totalRows}
                            className={`p-0 font-bold border-r border-slate-300 sticky left-0 z-10 w-12 min-w-[48px] max-w-[48px] shadow-[2px_0_5px_rgba(0,0,0,0.04)] select-none align-top ${
                              isToday ? 'bg-indigo-50' : 'bg-white'
                            }`}
                          >
                            <div className="py-3 px-1 w-12 min-w-[48px] max-w-[48px] text-center leading-tight flex flex-col items-center">
                              <div className="text-[10px] text-slate-400 mb-0.5">
                                {['一', '二', '三', '四', '五', '六', '日'][dayIdx]}
                              </div>
                              <div className={`text-xs ${isToday ? 'text-indigo-600 font-black' : 'text-slate-700'}`}>
                                {day.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                              </div>
                            </div>
                          </td>
                        )}

                        {/* 2. 時間欄：每一行都需要渲染，固定在 left-12 */}
                        <td
                          className={`p-0 font-bold text-xs border-r border-slate-300 sticky left-12 z-10 text-center select-none w-10 min-w-[40px] max-w-[40px] ${
                            isToday
                              ? 'bg-indigo-50 text-indigo-700'
                              : tp === '晨'
                              ? 'bg-emerald-50 text-emerald-700'
                              : tp === '08:00 - 12:00' || tp === '上午'
                              ? 'bg-violet-50 text-violet-700'
                              : tp === '12:00 - 15:00'
                              ? 'bg-rose-50 text-rose-700'
                              : tp === '15:00 - 18:00' || tp === '下午'
                              ? 'bg-sky-50 text-sky-700'
                              : tp === '18:00 ~' || tp === '晚上'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-white text-slate-600'
                          }`}
                        >
                          <div className="w-10 min-w-[40px] max-w-[40px] text-center">
                            {tp === '晨' ? (
                              <div className="text-[10px] py-1">晨</div>
                            ) : tp === '上午' ? (
                              <div className="text-[10px] py-1">上</div>
                            ) : tp === '下午' ? (
                              <div className="text-[10px] py-1">下</div>
                            ) : tp === '晚上' ? (
                              <div className="flex flex-col items-center leading-none text-[10px] py-1">
                                <span>晚</span>
                                <span className="mt-0.5">上</span>
                              </div>
                            ) : tp === '08:00 - 12:00' ? (
                              <div className="flex flex-col items-center leading-none text-[9px] py-1">
                                <span>上</span>
                                <span>午</span>
                                <span className="mt-1 text-violet-500 font-normal">8</span>
                                <span className="text-violet-500 font-normal scale-y-75">-</span>
                                <span className="text-violet-500 font-normal">12</span>
                              </div>
                            ) : tp === '12:00 - 15:00' ? (
                              <div className="flex flex-col items-center leading-none text-[9px] py-1">
                                <span>下</span>
                                <span className="mt-1 text-rose-500 font-normal">12</span>
                                <span className="text-rose-500 font-normal scale-y-75">-</span>
                                <span className="text-rose-500 font-normal">15</span>
                              </div>
                            ) : tp === '15:00 - 18:00' ? (
                              <div className="flex flex-col items-center leading-none text-[9px] py-1">
                                <span>下</span>
                                <span className="mt-1 text-sky-500 font-normal">15</span>
                                <span className="text-sky-500 font-normal scale-y-75">-</span>
                                <span className="text-sky-500 font-normal">18</span>
                              </div>
                            ) : tp === '18:00 ~' ? (
                              <div className="flex flex-col items-center leading-none text-[9px] py-1">
                                <span>晚</span>
                                <span>上</span>
                                <span className="mt-1 text-amber-500 font-normal">18</span>
                                <span className="text-amber-500 font-normal scale-y-75">-</span>
                              </div>
                            ) : (
                              tp || '-'
                            )}
                          </div>
                        </td>

                        {/* 3. 場地格：依據 leafColumns 與合併規則進行渲染 */}
                        {(() => {
                          const cells = [];
                          let colIdx = 0;
                          while (colIdx < leafColumns.length) {
                            const currentRoom = leafColumns[colIdx];
                            const parentId = currentRoom.parent_room_id;
                            const parentGroup = parentId ? groups.find(g => g.parent && g.parent.id === parentId) : null;
                            
                            let isMergedCell = false;
                            let mergeCount = 1;
                            let cellBookings: WeeklyBooking[] = [];
                            
                            if (parentGroup && parentGroup.parent) {
                              const parentRoom = parentGroup.parent;
                              const parentBookings = getBookingsForTimeAndRoom(dailyBookings, parentRoom.id, tp, isWeekday);
                              
                              if (parentBookings.length > 0) {
                                isMergedCell = true;
                                mergeCount = parentGroup.children.length;
                                cellBookings.push(...parentBookings);
                                
                                // 把對應子場地的預約也放進來（若有）
                                parentGroup.children.forEach(child => {
                                  const childBookings = getBookingsForTimeAndRoom(dailyBookings, child.id, tp, isWeekday);
                                  cellBookings.push(...childBookings);
                                });
                                
                                // 去除重複
                                const seenIds = new Set<number>();
                                cellBookings = cellBookings.filter(b => {
                                  if (seenIds.has(b.id)) return false;
                                  seenIds.add(b.id);
                                  return true;
                                });
                              }
                            }
                            
                            if (isMergedCell) {
                              cells.push(
                                <td
                                  key={`merged-${currentRoom.id}`}
                                  colSpan={mergeCount}
                                  onClick={() =>
                                    isClickable && onStartBooking && onStartBooking(dayStr, parentGroup?.parent?.id || currentRoom.id)
                                  }
                                  className={`p-1.5 align-top border-r border-slate-300 last:border-r-0 transition-colors bg-slate-50/30 ${
                                    isClickable ? 'cursor-pointer hover:bg-indigo-50/20' : ''
                                  }`}
                                >
                                  <div className="flex flex-col gap-2">
                                    {cellBookings.map(b => renderBookingCard(b))}
                                  </div>
                                </td>
                              );
                              colIdx += mergeCount;
                            } else {
                              const standaloneBookings = getBookingsForTimeAndRoom(dailyBookings, currentRoom.id, tp, isWeekday);
                              const processedBookings = standaloneBookings.map(b => {
                                const isDirect = b.room_id === currentRoom.id;
                                if (!isDirect) {
                                  return {
                                    ...b,
                                    isConflictPlaceholder: true,
                                    conflictRoomName: b.rooms?.name || '相關場地'
                                  };
                                }
                                return b;
                              });

                              cells.push(
                                <td
                                  key={currentRoom.id}
                                  onClick={() =>
                                    isClickable && onStartBooking && onStartBooking(dayStr, currentRoom.id)
                                  }
                                  className={`p-1.5 align-top border-r border-slate-300 last:border-r-0 transition-colors ${
                                    isClickable ? 'cursor-pointer hover:bg-indigo-50/30' : ''
                                  }`}
                                >
                                  {processedBookings.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                      {processedBookings.map(b => renderBookingCard(b))}
                                    </div>
                                  ) : (
                                    <div className="min-h-[24px]" />
                                  )}
                                </td>
                              );
                              colIdx += 1;
                            }
                          }
                          return cells;
                        })()}
                      </tr>
                    );
                  })}

                  {/* 4. 大掃除行 (如果有大掃除) */}
                  {cleanupBooking && (() => {
                    const isCleanupPast = isBookingPast(cleanupBooking.booking_date, cleanupBooking.end_time);
                    return (
                      <tr className="bg-rose-50/20 border-b border-slate-300">
                        {/* 時間欄：對齊大掃除的開始時間 */}
                        <td
                          className={`p-0 font-bold text-xs text-rose-600 border-r border-slate-300 sticky left-12 z-10 text-center select-none w-10 min-w-[40px] max-w-[40px] ${
                            isToday ? 'bg-indigo-50' : 'bg-white'
                          }`}
                        >
                          <div className="py-2 px-1 w-10 min-w-[40px] max-w-[40px] text-center font-black">
                            清
                          </div>
                        </td>

                        {/* 大掃除合併儲存格 */}
                        <td
                          colSpan={leafColumns.length}
                          className="p-2 border-r border-slate-300 align-middle"
                        >
                          <div
                            onClick={() => {
                              if (isAdmin && !isCleanupPast) {
                                setSelectedEditBooking(cleanupBooking);
                                setEditForm({
                                  pastoral_zone: cleanupBooking.pastoral_zone || '',
                                  purpose: cleanupBooking.purpose || '',
                                  attendance_count: cleanupBooking.attendance_count || 0,
                                  booking_date: cleanupBooking.booking_date,
                                  start_time: cleanupBooking.start_time.substring(0, 5),
                                  end_time: cleanupBooking.end_time.substring(0, 5),
                                  room_id: cleanupBooking.room_id
                                });
                                setIsEditModalOpen(true);
                              }
                            }}
                            className={`p-3.5 rounded-xl border border-rose-300 font-black text-xs md:text-sm shadow-md flex items-center justify-center gap-2 select-none ${
                              isCleanupPast
                                ? 'bg-slate-300 border-slate-400 text-slate-500 opacity-60'
                                : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white'
                            } ${
                              isAdmin && !isCleanupPast ? 'cursor-pointer hover:shadow-lg transition-all duration-200' : ''
                            }`}
                          >
                            <span className={isCleanupPast ? '' : 'animate-pulse'}>🚨</span>
                            <span>
                              {cleanupBooking.start_time.substring(0, 5)} - {cleanupBooking.end_time.substring(0, 5)}
                              {' '}【{cleanupBooking.purpose}】全場地進行清潔整理，此時段暫不開放外借 {isCleanupPast && '(已結束)'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {isOrderingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 relative border border-slate-100 text-left">
            <h3 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-2">
              ⚙️ 調整欄位顯示順序
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              調整週看板中的場地欄位順序（從左至右）。此順序將保存在此瀏覽器中。
            </p>

            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 mb-6">
              {tempRoomsOrder.map((room, index) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/70 transition-colors"
                >
                  <span className="font-bold text-slate-700 text-sm">{room.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        const newOrder = [...tempRoomsOrder];
                        newOrder[index] = newOrder[index - 1];
                        newOrder[index - 1] = room;
                        setTempRoomsOrder(newOrder);
                      }}
                      className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-500 transition-all active:scale-90"
                      title="往左移 (向上)"
                      data-no-debounce="true"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={index === tempRoomsOrder.length - 1}
                      onClick={() => {
                        const newOrder = [...tempRoomsOrder];
                        newOrder[index] = newOrder[index + 1];
                        newOrder[index + 1] = room;
                        setTempRoomsOrder(newOrder);
                      }}
                      className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-slate-500 transition-all active:scale-90"
                      title="往右移 (向下)"
                      data-no-debounce="true"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsOrderingModalOpen(false)}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-3 px-4 rounded-xl transition-all"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(`room_order_${currentBranch}`, JSON.stringify(tempRoomsOrder.map(r => r.id)));
                  setRooms(tempRoomsOrder);
                  setIsOrderingModalOpen(false);
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                確認儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedEditBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-5 sm:p-6 md:p-8 max-w-md w-full max-h-[82dvh] sm:max-h-[85dvh] flex flex-col min-h-0 shadow-2xl animate-in zoom-in-95 duration-200 relative border border-slate-100 text-left">
            <div className="shrink-0">
              <h3 className="text-xl font-black text-slate-800 mb-1 flex items-center gap-2">
                ✏️ 編輯場地預約排程
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                修改此筆預約的詳細資料。此動作將會直接更新系統中的排程。
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">使用場地</label>
                <select
                  value={editForm.room_id}
                  onChange={e => setEditForm({ ...editForm, room_id: Number(e.target.value) })}
                  disabled={selectedEditBooking.status === 'approved'}
                  className={`w-full border rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-sm ${
                    selectedEditBooking.status === 'approved'
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {selectedEditBooking.status === 'approved' && (
                  <p className="mt-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    🔒 已核可的預約無法直接改場地，請先按下方「↩ 退回待審核」。
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">使用日期</label>
                <input
                  type="date"
                  value={editForm.booking_date}
                  onChange={e => setEditForm({ ...editForm, booking_date: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">開始時間</label>
                  <input
                    type="time"
                    value={editForm.start_time}
                    onChange={e => setEditForm({ ...editForm, start_time: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">結束時間</label>
                  <input
                    type="time"
                    value={editForm.end_time}
                    onChange={e => setEditForm({ ...editForm, end_time: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">所屬單位 / 牧區</label>
                <input
                  type="text"
                  value={editForm.pastoral_zone}
                  onChange={e => setEditForm({ ...editForm, pastoral_zone: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 text-sm"
                  placeholder="例如：大安區、慶典牧區"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">使用目的 / 聚會名稱</label>
                <textarea
                  value={editForm.purpose}
                  onChange={e => setEditForm({ ...editForm, purpose: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 text-sm resize-y"
                  placeholder="例如：小組聚會"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">預估人數</label>
                <input
                  type="number"
                  value={editForm.attendance_count}
                  onChange={e => setEditForm({ ...editForm, attendance_count: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-xl py-2.5 px-3.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 text-sm"
                  min="1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4 shrink-0">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  className="border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-all select-none"
                >
                  ❌ 取消預約
                </button>
                {selectedEditBooking.status === 'approved' && (
                  <button
                    type="button"
                    onClick={handleRevertToPending}
                    className="border border-amber-300 hover:bg-amber-50 text-amber-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all select-none"
                  >
                    ↩ 退回待審核
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedEditBooking(null);
                  }}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-2.5 px-4 rounded-xl text-xs transition-all select-none"
                >
                  關閉
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center select-none"
                >
                  確認儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

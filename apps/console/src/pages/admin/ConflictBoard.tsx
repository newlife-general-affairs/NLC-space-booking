import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetchRooms, apiAssignBookingRoom, apiUpdateBookingStatus } from '@church/shared/api';
import { computeOverlapMap } from '@church/shared/domain/bookingConflicts';
import {
  applyStoredRoomOrder,
  bucketOfStartTime,
  fmtLocalDate,
  getRelatedRoomIds,
  getTimeRows,
  isVirtualRoom,
  isWeekdayDate,
  toMondayFirstIndex,
  weekDatesMondayFirst,
} from '@church/shared/domain/roomGrid';
import type { Booking, Room } from '@church/shared/types';

interface ConflictBoardProps {
  /** 該據點的所有預約（來自 apiFetchAdminBookings，未遮罩） */
  data: Booking[];
  getToken: () => string;
  onClose: () => void;
  onRefresh: () => void;
  /** 初始日期 yyyy-mm-dd；預設為衝突最多的那一天，否則今天 */
  initialDate?: string;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const isPast = (dateStr: string, endTimeStr: string) => {
  try {
    const now = new Date();
    const [hours, minutes] = endTimeStr.split(':').map(Number);
    let targetDateStr = dateStr;
    if (hours === 0 && minutes === 0) {
      const nextDay = new Date(`${dateStr}T00:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      targetDateStr = fmtLocalDate(nextDay);
    }
    const end = new Date(
      `${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
    );
    return now > end;
  } catch {
    return false;
  }
};

const weekdayLabelOf = (dateStr: string) =>
  WEEKDAY_LABELS[toMondayFirstIndex(new Date(`${dateStr}T00:00:00`).getDay())];

export default function ConflictBoard({
  data,
  getToken,
  onClose,
  onRefresh,
  initialDate,
}: ConflictBoardProps) {
  const [bookings, setBookings] = useState<Booking[]>(data);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  // 鍵盤操作：拿起中的預約 + 目前選定的落點場地
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [kbTargetRoomId, setKbTargetRoomId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBookings(data);
  }, [data]);

  const branch = useMemo(
    () => data.find((b) => b.rooms?.branch)?.rooms?.branch ?? '',
    [data],
  );

  const overlapMap = useMemo(() => computeOverlapMap(bookings), [bookings]);

  const busiestConflictDate = useMemo(() => {
    // 優先挑「有可拖曳（待審核且未過期）衝突」的那一天，其次才是任何衝突最多的那一天。
    const draggableCounts: Record<string, number> = {};
    const anyCounts: Record<string, number> = {};
    for (const idStr of Object.keys(overlapMap)) {
      const b = bookings.find((x) => x.id === Number(idStr));
      if (!b) continue;
      anyCounts[b.booking_date] = (anyCounts[b.booking_date] || 0) + 1;
      if (b.status === 'pending' && !isPast(b.booking_date, b.end_time)) {
        draggableCounts[b.booking_date] = (draggableCounts[b.booking_date] || 0) + 1;
      }
    }
    const pickMax = (counts: Record<string, number>) => {
      let best: string | null = null;
      let bestN = 0;
      for (const d in counts) {
        if (counts[d] > bestN) {
          bestN = counts[d];
          best = d;
        }
      }
      return best;
    };
    return pickMax(draggableCounts) || pickMax(anyCounts);
  }, [overlapMap, bookings]);

  const [currentDate, setCurrentDate] = useState<string>(
    initialDate || busiestConflictDate || fmtLocalDate(new Date()),
  );
  const pinnedInitial = useRef(false);
  useEffect(() => {
    if (pinnedInitial.current) return;
    if (!initialDate && busiestConflictDate) {
      setCurrentDate(busiestConflictDate);
      pinnedInitial.current = true;
    }
  }, [initialDate, busiestConflictDate]);

  useEffect(() => {
    if (!branch) return;
    apiFetchRooms(branch)
      .then((d: unknown) => {
        if (Array.isArray(d)) setRooms(d as Room[]);
      })
      .catch(() => setToast({ kind: 'err', text: '載入場地清單失敗' }));
  }, [branch]);

  const showToast = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const cancelPickup = useCallback(() => {
    setPickedId(null);
    setKbTargetRoomId(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pickedId !== null) cancelPickup();
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pickedId, cancelPickup]);

  const visibleDates = useMemo(
    () => (view === 'week' ? weekDatesMondayFirst(currentDate) : [currentDate]),
    [view, currentDate],
  );

  const columns = useMemo(
    () => applyStoredRoomOrder(rooms.filter((r) => !isVirtualRoom(r.name)), branch),
    [rooms, branch],
  );

  const bookingsOn = useCallback(
    (dateStr: string) =>
      bookings.filter(
        (b) =>
          b.booking_date === dateStr &&
          b.status !== 'rejected' &&
          !isPast(b.booking_date, b.end_time),
      ),
    [bookings],
  );

  const weekConflictCount = useMemo(() => {
    const set = new Set(visibleDates);
    return Object.keys(overlapMap).filter((idStr) => {
      const b = bookings.find((x) => x.id === Number(idStr));
      return b && set.has(b.booking_date);
    }).length;
  }, [overlapMap, bookings, visibleDates]);

  const conflictCountOn = useCallback(
    (dateStr: string) => bookingsOn(dateStr).filter((b) => overlapMap[b.id]).length,
    [bookingsOn, overlapMap],
  );

  // 目前檢視範圍內，實際「可拖曳」（待審核且未過期）的預約數
  const draggableInView = useMemo(
    () =>
      visibleDates.reduce(
        (sum, d) =>
          sum +
          bookingsOn(d).filter(
            (b) => b.status === 'pending' && !isPast(b.booking_date, b.end_time),
          ).length,
        0,
      ),
    [visibleDates, bookingsOn],
  );

  const activeId = draggingId ?? pickedId;
  const activeBooking = activeId ? bookings.find((b) => b.id === activeId) ?? null : null;
  const activeBucket = activeBooking
    ? bucketOfStartTime(activeBooking.start_time, isWeekdayDate(activeBooking.booking_date))
    : null;

  const canDrop = useCallback(
    (b: Booking, roomId: number): boolean => {
      if (b.status !== 'pending') return false;
      if (isPast(b.booking_date, b.end_time)) return false;
      if (roomId === b.room_id) return false;
      const target = rooms.find((r) => r.id === roomId);
      if (!target || isVirtualRoom(target.name)) return false;
      const related = getRelatedRoomIds(roomId, rooms);
      for (const o of bookingsOn(b.booking_date)) {
        if (o.id === b.id) continue;
        if (o.status !== 'approved' && o.status !== 'pending') continue;
        if (!related.has(o.room_id)) continue;
        if (b.start_time < o.end_time && b.end_time > o.start_time) return false;
      }
      return true;
    },
    [rooms, bookingsOn],
  );

  const droppableRoomIdsFor = useCallback(
    (b: Booking) => columns.filter((r) => canDrop(b, r.id)).map((r) => r.id),
    [columns, canDrop],
  );

  const performMove = useCallback(
    async (b: Booking, roomId: number) => {
      const prevRoomId = b.room_id;
      const roomName = rooms.find((r) => r.id === roomId)?.name ?? '新場地';
      setBusyId(b.id);
      setDraggingId(null);
      cancelPickup();
      setBookings((bs) => bs.map((x) => (x.id === b.id ? { ...x, room_id: roomId } : x)));
      try {
        const res = await apiAssignBookingRoom(getToken(), b.id, roomId);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setBookings((bs) =>
            bs.map((x) => (x.id === b.id ? { ...x, room_id: prevRoomId } : x)),
          );
          showToast('err', err.error || '搬移場地失敗');
        } else {
          showToast('ok', `已將「${b.full_name}」改到「${roomName}」`);
          onRefresh();
        }
      } catch {
        setBookings((bs) =>
          bs.map((x) => (x.id === b.id ? { ...x, room_id: prevRoomId } : x)),
        );
        showToast('err', '網路錯誤，請稍後重試');
      } finally {
        setBusyId(null);
      }
    },
    [rooms, getToken, onRefresh, showToast, cancelPickup],
  );

  const revertToPending = useCallback(
    async (b: Booking) => {
      if (
        !window.confirm(
          `確定將「${b.full_name}」退回待審核？\n若已發放門鎖密碼將一併清除，重新核可後需再發送。`,
        )
      )
        return;
      setBusyId(b.id);
      try {
        const res = await apiUpdateBookingStatus(getToken(), b.id, 'pending');
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast('err', err.error || '退回待審核失敗');
        } else {
          setBookings((bs) =>
            bs.map((x) =>
              x.id === b.id
                ? { ...x, status: 'pending', access_code: undefined, tuya_password_id: null }
                : x,
            ),
          );
          showToast('ok', `已將「${b.full_name}」退回待審核，現在可拖曳`);
          onRefresh();
        }
      } catch {
        showToast('err', '網路錯誤，請稍後重試');
      } finally {
        setBusyId(null);
      }
    },
    [getToken, onRefresh, showToast],
  );

  const shiftDate = (dir: -1 | 1) => {
    const step = view === 'week' ? 7 : 1;
    const d = new Date(`${currentDate}T00:00:00`);
    d.setDate(d.getDate() + dir * step);
    setCurrentDate(fmtLocalDate(d));
    setDraggingId(null);
    cancelPickup();
  };

  const onBlockKeyDown = (e: React.KeyboardEvent, b: Booking, canGrab: boolean) => {
    const picked = pickedId === b.id;
    if ((e.key === 'Enter' || e.key === ' ') && (canGrab || picked)) {
      e.preventDefault();
      if (!picked) {
        const opts = droppableRoomIdsFor(b);
        setPickedId(b.id);
        setKbTargetRoomId(opts[0] ?? null);
        showToast(
          'ok',
          opts.length
            ? '已拿起：← → 選場地，Enter 放下，Esc 取消'
            : '此預約目前沒有其他可放的場地',
        );
      } else if (kbTargetRoomId != null) {
        performMove(b, kbTargetRoomId);
      } else {
        cancelPickup();
      }
      return;
    }
    if (picked && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const opts = droppableRoomIdsFor(b);
      if (!opts.length) return;
      const cur = kbTargetRoomId != null ? opts.indexOf(kbTargetRoomId) : -1;
      const next =
        e.key === 'ArrowRight'
          ? (cur + 1 + opts.length) % opts.length
          : (cur - 1 + opts.length) % opts.length;
      setKbTargetRoomId(opts[next]);
    }
  };

  const renderBlock = (b: Booking) => {
    const past = isPast(b.booking_date, b.end_time);
    const isPending = b.status === 'pending';
    const isApproved = b.status === 'approved';
    const hasConflict = !!overlapMap[b.id];
    const canGrab = isPending && !past && busyId === null;
    const picked = pickedId === b.id;

    return (
      <div
        key={b.id}
        draggable={canGrab}
        tabIndex={canGrab || isApproved ? 0 : -1}
        role={canGrab ? 'button' : undefined}
        aria-grabbed={picked || draggingId === b.id}
        onKeyDown={(e) => onBlockKeyDown(e, b, canGrab)}
        onDragStart={(e) => {
          if (!canGrab) return;
          setPickedId(null);
          setDraggingId(b.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(b.id));
          const ghost = document.createElement('div');
          ghost.textContent = `➜ ${b.purpose || b.full_name}`;
          ghost.style.cssText =
            'position:absolute;top:-1000px;left:-1000px;padding:6px 10px;border-radius:8px;' +
            'background:#4f46e5;color:#fff;font-size:12px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.25)';
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 12, 12);
          setTimeout(() => ghost.remove(), 0);
        }}
        onDragEnd={() => setDraggingId(null)}
        title={
          canGrab
            ? '拖曳（或按 Enter 拿起）到其他場地欄位即可改場地，時間不變'
            : isApproved && !past
            ? '已核可：請先「退回待審核」才能改場地'
            : undefined
        }
        className={`rounded-lg border p-2 text-left shadow-sm text-[11px] leading-tight select-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          draggingId === b.id || picked ? 'opacity-40 scale-95' : ''
        } ${
          past
            ? 'bg-slate-100 border-slate-300 text-slate-400 opacity-60'
            : isApproved
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50/70 border-amber-300 border-dashed text-amber-900'
        } ${hasConflict && !past ? 'ring-2 ring-rose-400 ring-offset-1 animate-pulse' : ''} ${
          canGrab ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono font-bold text-[10px] text-slate-600">
            {b.start_time?.substring(0, 5)}-{b.end_time?.substring(0, 5)}
          </span>
          {isApproved && !past && <span className="text-[9px]" title="已核可，鎖定">🔒</span>}
          {hasConflict && !past && <span className="text-[9px]">⚠️</span>}
        </div>
        {b.pastoral_zone && (
          <div className="text-[10px] font-semibold text-indigo-600/90 mt-0.5 truncate">
            {b.pastoral_zone}
          </div>
        )}
        <div className="font-bold whitespace-pre-wrap break-all mt-0.5">{b.purpose}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {b.full_name}・{b.attendance_count} 人
        </div>

        {isApproved && !past && (
          <button
            onClick={() => revertToPending(b)}
            disabled={busyId !== null}
            className="mt-1.5 w-full bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold py-1 rounded-md text-[10px] transition-colors disabled:opacity-50"
          >
            ↩ 退回待審核
          </button>
        )}
        {picked && (
          <div className="mt-1 text-[9px] font-bold text-emerald-600">
            ← → 選場地・Enter 放下・Esc 取消
          </div>
        )}
        {canGrab && !picked && hasConflict && (
          <div className="mt-1 text-[9px] font-bold text-rose-500">拖我到空位 →</div>
        )}
      </div>
    );
  };

  const renderCell = (dateStr: string, room: Room, row: string, isWeekday: boolean) => {
    const cellBookings = bookingsOn(dateStr).filter(
      (b) => b.room_id === room.id && bucketOfStartTime(b.start_time, isWeekday) === row,
    );

    const isCandidate =
      !!activeBooking && dateStr === activeBooking.booking_date && row === activeBucket;
    const droppable = isCandidate && !!activeBooking && canDrop(activeBooking, room.id);
    const isOrigin = isCandidate && !!activeBooking && room.id === activeBooking.room_id;
    const blocked = isCandidate && !droppable && !isOrigin;
    const isKbTarget = droppable && pickedId != null && room.id === kbTargetRoomId;

    return (
      <td
        key={`${dateStr}-${room.id}`}
        onDragOver={(e) => {
          if (droppable) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => {
          if (!droppable || !activeBooking) return;
          e.preventDefault();
          performMove(activeBooking, room.id);
        }}
        className={`border-r border-slate-200 p-1.5 align-top transition-colors ${
          isKbTarget
            ? 'bg-emerald-200 ring-4 ring-inset ring-emerald-500'
            : droppable
            ? 'bg-emerald-100/70 ring-2 ring-inset ring-emerald-400'
            : isOrigin
            ? 'ring-2 ring-inset ring-slate-300 ring-dashed bg-slate-50'
            : blocked
            ? 'bg-[repeating-linear-gradient(45deg,#e2e8f0_0_4px,#f8fafc_4px_8px)] opacity-70'
            : ''
        }`}
      >
        <div className="flex flex-col gap-1.5 min-h-[28px]">{cellBookings.map(renderBlock)}</div>
      </td>
    );
  };

  const headerConflict = view === 'week' ? weekConflictCount : conflictCountOn(currentDate);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-label="拖曳調整場地衝突看板" className="bg-white rounded-2xl w-full max-w-[1500px] max-h-[94dvh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 頂列 */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 bg-indigo-50/60 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-black text-indigo-900">🧩 拖曳調整場地</span>
            <span
              className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                headerConflict > 0
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
              }`}
            >
              {view === 'week' ? '本週衝突' : '本日衝突'} {headerConflict}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white text-xs font-bold">
              <button
                onClick={() => {
                  setView('day');
                  cancelPickup();
                }}
                className={`px-3 py-1.5 transition-colors ${
                  view === 'day' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                單日
              </button>
              <button
                onClick={() => {
                  setView('week');
                  cancelPickup();
                }}
                className={`px-3 py-1.5 transition-colors ${
                  view === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                整週
              </button>
            </div>

            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-indigo-600 border border-slate-200 bg-white/70"
              title={view === 'week' ? '前一週' : '前一天'}
            >
              ‹
            </button>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => {
                if (e.target.value) {
                  setCurrentDate(e.target.value);
                  setDraggingId(null);
                  cancelPickup();
                }
              }}
              className="text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {view === 'day' && (
              <span className="text-xs font-bold text-slate-500 min-w-[28px] text-center">
                （{weekdayLabelOf(currentDate)}）
              </span>
            )}
            <button
              onClick={() => shiftDate(1)}
              className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-indigo-600 border border-slate-200 bg-white/70"
              title={view === 'week' ? '後一週' : '後一天'}
            >
              ›
            </button>
          </div>

          <button
            onClick={onClose}
            className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all shadow-sm"
          >
            關閉
          </button>
        </div>

        {/* 圖例 */}
        <div className="shrink-0 px-4 sm:px-6 py-2 border-b border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500 font-bold bg-white">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-300 border-dashed" /> 待審核（可拖）</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-200" /> 已核可 🔒（需先退回）</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded ring-2 ring-rose-400 bg-white" /> 時段衝突</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-100 ring-2 ring-emerald-400" /> 可放</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-[repeating-linear-gradient(45deg,#e2e8f0_0_4px,#f8fafc_4px_8px)]" /> 不可放</span>
          <span className="text-slate-400">鍵盤：Tab 聚焦 → Enter 拿起 → ← → 選場地 → Enter 放下 / Esc 取消</span>
        </div>

        {/* 沒有可拖曳項目時的提示 */}
        {columns.length > 0 && draggableInView === 0 && (
          <div className="shrink-0 px-4 sm:px-6 py-2.5 border-b border-amber-200 bg-amber-50 text-[11px] font-bold text-amber-800">
            {headerConflict > 0
              ? '本' +
                (view === 'week' ? '週' : '日') +
                '的衝突預約都是「已核可」或「已過期」，無法直接拖曳。請先在該預約按「↩ 退回待審核」，或切換到其他日期。'
              : '本' + (view === 'week' ? '週' : '日') + '沒有待處理的待審核預約。用上方日期切換到有衝突的日子。'}
          </div>
        )}

        {/* 網格 */}
        <div className="flex-1 overflow-auto">
          {columns.length === 0 ? (
            <div className="py-20 text-center text-sm text-slate-400">載入場地中...</div>
          ) : (
            <table
              className="border-collapse text-sm"
              style={{ minWidth: (view === 'week' ? 150 : 90) + columns.length * 150 }}
            >
              <thead>
                <tr className="bg-slate-50">
                  {view === 'week' && (
                    <th className="sticky left-0 top-0 z-30 bg-slate-100 border-b border-r border-slate-300 w-16 min-w-[64px] p-2 text-[11px] font-bold text-slate-500">
                      日期
                    </th>
                  )}
                  <th
                    className={`sticky top-0 z-30 bg-slate-100 border-b border-r border-slate-300 w-14 min-w-[56px] p-2 text-[11px] font-bold text-slate-500 ${
                      view === 'week' ? 'left-16' : 'left-0'
                    }`}
                  >
                    時段
                  </th>
                  {columns.map((room) => (
                    <th
                      key={room.id}
                      className="sticky top-0 z-20 bg-slate-50 border-b border-r border-slate-300 min-w-[150px] p-2 text-center text-xs font-bold text-slate-700"
                    >
                      {room.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {visibleDates.map((dateStr) => {
                  const isWeekday = isWeekdayDate(dateStr);
                  const timeRows = getTimeRows(isWeekday);
                  const dayConflicts = conflictCountOn(dateStr);
                  return timeRows.map((row, rowIdx) => (
                    <tr
                      key={`${dateStr}-${row}`}
                      className={`align-top border-b ${
                        rowIdx === timeRows.length - 1 ? 'border-slate-300' : 'border-slate-100'
                      }`}
                    >
                      {view === 'week' && rowIdx === 0 && (
                        <td
                          rowSpan={timeRows.length}
                          className="sticky left-0 z-10 bg-white border-r border-slate-300 w-16 min-w-[64px] p-2 text-center align-top"
                        >
                          <div className="text-[10px] text-slate-400">（{weekdayLabelOf(dateStr)}）</div>
                          <div className="text-xs font-black text-slate-700">
                            {dateStr.slice(5).replace('-', '/')}
                          </div>
                          {dayConflicts > 0 && (
                            <div className="mt-1 text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200 rounded px-1">
                              衝突 {dayConflicts}
                            </div>
                          )}
                        </td>
                      )}
                      <td
                        className={`sticky z-10 bg-white border-r border-slate-300 w-14 min-w-[56px] p-2 text-center text-[11px] font-bold text-slate-500 ${
                          view === 'week' ? 'left-16' : 'left-0'
                        }`}
                      >
                        {row}
                      </td>
                      {columns.map((room) => renderCell(dateStr, room, row, isWeekday))}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`shrink-0 px-4 sm:px-6 py-3 text-xs font-bold border-t ${
              toast.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {toast.kind === 'ok' ? '✓ ' : '⚠️ '}
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}

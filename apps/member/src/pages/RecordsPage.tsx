import { useState } from 'react';
import { ClipboardList, Eye, EyeOff, KeyRound, ListFilter, Pencil, Wrench, XCircle } from 'lucide-react';
import type { Booking, Room } from '@church/shared/types';
import { EmptyState, ListRow, SegmentedControl, Sheet, StatusPill, Button } from '../ui';
import EditBookingSheet from '../components/EditBookingSheet';
import type { BookingEditInput, ManageResult } from '../hooks/useBookingManage';

interface RecordsPageProps {
  bookings: Booking[];
  rooms: Room[];
  /** 非一般使用者（同工）不受「借用日 7 天內不能線上修改／取消」限制 */
  canBypassSevenDays: boolean;
  manageBusy: boolean;
  onUpdateBooking: (booking: Booking, input: BookingEditInput) => Promise<ManageResult>;
  onCancelBooking: (booking: Booking) => Promise<ManageResult>;
  onStartCleanup: (booking: Booking) => void;
  onReportIssue: (booking: Booking) => void;
}

/** 與後端 SELF_CANCEL_REASON 一致 */
const SELF_CANCEL_REASON = '使用者自行取消';

type Segment = 'upcoming' | 'cleanup' | 'completed' | 'rejected';

const SEGMENT_LABEL: Record<Segment, string> = {
  upcoming: '即將到來',
  cleanup: '待清潔歸還',
  completed: '已完成',
  rejected: '取消／未通過',
};

// Helper to determine if a booking is overdue for return (1 hour past end time)
const isOverdue = (dateStr: string, endTimeStr: string) => {
  try {
    const endPart = endTimeStr.substring(0, 5);
    const [parsedHours, minutes] = endPart.split(':').map(Number);
    let hours = parsedHours + 1;
    let targetDateStr = dateStr;
    if (hours >= 24) {
      hours -= 24;
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      targetDateStr = nextDay.toISOString().split('T')[0];
    }
    const overdueTime = new Date(`${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    return new Date() > overdueTime;
  } catch { return false; }
};

const hasStarted = (dateStr: string, startTimeStr: string) => {
  try {
    const startPart = startTimeStr.substring(0, 5);
    const [hours, minutes] = startPart.split(':').map(Number);
    const startTime = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    return new Date() >= startTime;
  } catch { return false; }
};

const getReportIssueDisabledState = (dateStr: string, startTimeStr: string, endTimeStr: string) => {
  try {
    const startPart = startTimeStr.substring(0, 5);
    const [shours, sminutes] = startPart.split(':').map(Number);
    const startTime = new Date(`${dateStr}T${String(shours).padStart(2, '0')}:${String(sminutes).padStart(2, '0')}:00`);

    const endPart = endTimeStr.substring(0, 5);
    const [parsedEndHours, eminutes] = endPart.split(':').map(Number);
    let ehours = parsedEndHours;
    let daysToAdd = endPart === '00:00' ? 1 : 0;
    ehours += 8;
    if (ehours >= 24) { daysToAdd += Math.floor(ehours / 24); ehours = ehours % 24; }

    let targetDateStr = dateStr;
    if (daysToAdd > 0) {
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + daysToAdd);
      targetDateStr = nextDay.toISOString().split('T')[0];
    }
    const allowedTime = new Date(`${targetDateStr}T${String(ehours).padStart(2, '0')}:${String(eminutes).padStart(2, '0')}:00`);
    const now = new Date();
    if (now < startTime) return { disabled: true, title: '未到借用時間' };
    if (now > allowedTime) return { disabled: true, title: '已超過借用完畢後 8 小時回報期限' };
    return { disabled: false, title: '' };
  } catch { return { disabled: true, title: '' }; }
};

const hasEnded = (dateStr: string, endTimeStr: string) => {
  try {
    const endPart = endTimeStr.substring(0, 5);
    const [hours, minutes] = endPart.split(':').map(Number);
    const daysToAdd = endPart === '00:00' ? 1 : 0;
    let targetDateStr = dateStr;
    if (daysToAdd > 0) {
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + daysToAdd);
      targetDateStr = nextDay.toISOString().split('T')[0];
    }
    const endTime = new Date(`${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    return new Date() > endTime;
  } catch { return false; }
};

const isWithinSevenDays = (dateStr: string) => {
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const bookingTime = new Date(yr, mo - 1, dy).getTime();
  const now = new Date();
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return bookingTime - todayTime < 7 * 24 * 60 * 60 * 1000;
};

/** 尚未開始、未取消、未歸還的預約才能修改或取消；表單匯入的「取消或異動」申請不算 */
const canModify = (row: Booking) =>
  row.status !== 'rejected' &&
  !row.is_returned &&
  row.booking_type !== '取消或異動' &&
  !hasStarted(row.booking_date, row.start_time);

function parseCleaning(row: Booking) {
  const parts = (row.cleaning_assignments || '').split('::');
  return { text: parts[0] || '', state: parts[1] || '' };
}

function getSegment(row: Booking): Segment {
  if (row.status === 'rejected') return 'rejected';
  if (row.is_returned) return 'completed';
  if (row.status === 'approved' && hasStarted(row.booking_date, row.start_time)) return 'cleanup';
  return 'upcoming';
}

export default function RecordsPage({
  bookings, rooms, canBypassSevenDays, manageBusy,
  onUpdateBooking, onCancelBooking, onStartCleanup, onReportIssue,
}: RecordsPageProps) {
  const [segment, setSegment] = useState<Segment>('upcoming');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [revealedIds, setRevealedIds] = useState<number[]>([]);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [detailError, setDetailError] = useState('');

  const openDetail = (row: Booking | null) => {
    setDetail(row);
    setConfirmingCancel(false);
    setDetailError('');
  };

  const handleCancel = async () => {
    if (!detail) return;
    const result = await onCancelBooking(detail);
    if (result.ok) openDetail(null);
    else setDetailError(result.message);
  };

  const handleUpdate = async (input: BookingEditInput): Promise<ManageResult> => {
    if (!editing) return { ok: false, message: '' };
    const result = await onUpdateBooking(editing, input);
    if (result.ok) setEditing(null);
    return result;
  };

  const toggleReveal = (id: number) =>
    setRevealedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const uniqueRooms = Array.from(new Set(bookings.map(b => b.room_name).filter(Boolean))).sort();

  const bySegment = bookings.filter(b => getSegment(b) === segment);
  const filtered = bySegment
    .filter(b => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q ||
        (b.room_name || '').toLowerCase().includes(q) ||
        (b.full_name || '').toLowerCase().includes(q) ||
        (b.purpose || '').toLowerCase().includes(q);
      const matchesRoom = !selectedRoom || b.room_name === selectedRoom;
      return matchesSearch && matchesRoom;
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id);

  const counts: Record<Segment, number> = { upcoming: 0, cleanup: 0, completed: 0, rejected: 0 };
  bookings.forEach(b => { counts[getSegment(b)] += 1; });

  const detailCleaning = detail ? parseCleaning(detail) : null;
  const detailOverdue = detail ? isOverdue(detail.booking_date, detail.end_time) : false;
  const detailModifiable = detail ? canModify(detail) : false;
  const detailLocked = detail ? !canBypassSevenDays && isWithinSevenDays(detail.booking_date) : false;

  return (
    <div className="pt-3 pb-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-ink flex items-center gap-2">
          <ClipboardList size={18} className="text-primary" /> 我的預約
        </h2>
        <button
          type="button"
          onClick={() => setFiltersOpen(v => !v)}
          className="w-9 h-9 rounded-full bg-surface-sunken text-ink-soft flex items-center justify-center"
        >
          <ListFilter size={16} />
        </button>
      </div>

      {filtersOpen && (
        <div className="card p-3 space-y-2.5">
          <input
            type="text"
            placeholder="搜尋空間、姓名、用途…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input"
          />
          <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="input">
            <option value="">所有場地空間</option>
            {uniqueRooms.map(room => <option key={room} value={room}>{room}</option>)}
          </select>
        </div>
      )}

      <SegmentedControl
        value={segment}
        onChange={setSegment}
        options={(['upcoming', 'cleanup', 'completed', 'rejected'] as Segment[]).map(s => ({ value: s, label: SEGMENT_LABEL[s], count: counts[s] }))}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title={bookings.length === 0 ? '目前尚無預約記錄' : '此分類目前沒有記錄'} />
      ) : (
        <div className="space-y-2.5">
          {filtered.map(row => {
            const cleaning = parseCleaning(row);
            const overdue = isOverdue(row.booking_date, row.end_time);
            return (
              <ListRow
                key={row.id}
                onClick={() => openDetail(row)}
                title={row.room_name}
                subtitle={`${row.booking_date} · ${row.start_time.substring(0, 5)}-${row.end_time.substring(0, 5)}`}
                icon={<KeyRound size={16} />}
                trailing={
                  row.status === 'rejected'
                    ? row.rejection_reason === SELF_CANCEL_REASON ? <StatusPill tone="muted" label="已取消" /> : <StatusPill tone="danger" label="未通過" />
                  : row.is_returned ? <StatusPill tone="success" label="歸還成功" />
                  : cleaning.state === 'submitted' || cleaning.state === 'resubmitted' ? <StatusPill tone="warning" label="待檢查" pulse />
                  : (row.violation || overdue) ? <StatusPill tone="danger" label="違規記點" />
                  : cleaning.state === 'rejected' ? <StatusPill tone="danger" label="檢查退回" />
                  : row.status === 'pending' ? <StatusPill tone="muted" label="審核中" />
                  : <StatusPill tone="success" label="已核可" />
                }
              />
            );
          })}
        </div>
      )}

      <Sheet open={!!detail} onClose={() => openDetail(null)} dismissible={!manageBusy} title={detail?.room_name}>
        {detail && detailCleaning && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-sunken rounded-2xl text-sm">
              <div><div className="text-[10px] text-ink-faint font-bold mb-0.5">使用日期</div><div className="font-bold text-ink">{detail.booking_date}</div></div>
              <div><div className="text-[10px] text-ink-faint font-bold mb-0.5">借用時間</div><div className="font-bold text-ink">{detail.start_time.substring(0, 5)}-{detail.end_time.substring(0, 5)}</div></div>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-faint">借用人</span><span className="font-bold text-ink">{detail.full_name}（{detail.pastoral_zone}）</span></div>
              <div className="flex justify-between"><span className="text-ink-faint">聯絡電話</span><span className="font-bold text-ink">{detail.phone}</span></div>
              <div className="flex justify-between gap-4"><span className="text-ink-faint shrink-0">用途</span><span className="font-bold text-ink text-right">{detail.purpose}（{detail.attendance_count} 人）</span></div>
              {detailCleaning.text && <div className="flex justify-between"><span className="text-ink-faint">打掃指派</span><span className="font-bold text-ink">{detailCleaning.text}</span></div>}
              {detail.status === 'rejected' && detail.rejection_reason && (
                <div className="flex justify-between gap-4">
                  <span className="text-ink-faint shrink-0">{detail.rejection_reason === SELF_CANCEL_REASON ? '狀態' : '未通過原因'}</span>
                  <span className="font-bold text-ink text-right">{detail.rejection_reason === SELF_CANCEL_REASON ? '已自行取消' : detail.rejection_reason}</span>
                </div>
              )}
            </div>

            <div className="divider" />

            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-faint font-bold flex items-center gap-1.5"><KeyRound size={14} /> 門鎖密碼</span>
              {detail.status === 'approved' && detail.access_code ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 bg-surface-sunken px-2 py-1 rounded-lg">
                    <span className="font-mono text-primary font-black tracking-widest">{revealedIds.includes(detail.id) ? detail.access_code : '••••'}</span>
                    <button onClick={() => toggleReveal(detail.id)} data-no-debounce="true" className="text-ink-faint">
                      {revealedIds.includes(detail.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {(detail.tuya_device_id || detail.rooms?.tuya_device_id) && (
                    detail.tuya_password_id
                      ? <StatusPill tone="success" label="智慧鎖已同步" />
                      : <StatusPill tone="danger" label="門鎖不同步" />
                  )}
                </div>
              ) : (
                <span className="text-xs text-ink-faint italic">
                  {detail.status === 'pending' ? '待核可後發送' : hasEnded(detail.booking_date, detail.end_time) ? '已失效' : '未發送'}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {!detail.is_returned && detailCleaning.state !== 'submitted' && detailCleaning.state !== 'resubmitted' && !detailOverdue && !detail.violation && detail.status === 'approved' && (
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!hasStarted(detail.booking_date, detail.start_time)}
                  onClick={() => { onStartCleanup(detail); openDetail(null); }}
                >
                  <Wrench size={16} /> {detailCleaning.state === 'rejected' ? '複檢確認' : '使用完畢確認'}
                </Button>
              )}
              {detail.status === 'approved' && (
                <Button
                  variant="secondary"
                  fullWidth
                  disabled={getReportIssueDisabledState(detail.booking_date, detail.start_time, detail.end_time).disabled}
                  onClick={() => { onReportIssue(detail); openDetail(null); }}
                >
                  回報場地問題
                </Button>
              )}

              {detailModifiable && (
                detailLocked ? (
                  <p className="text-xs text-ink-faint text-center py-1">借用日 7 天內無法線上修改或取消，請聯絡管理單位或值班人員。</p>
                ) : confirmingCancel ? (
                  <div className="p-3 rounded-2xl bg-danger/10 space-y-2.5">
                    <p className="text-xs text-danger font-semibold leading-relaxed">
                      確定要取消這筆預約嗎？取消後無法復原{detail.status === 'approved' ? '，門鎖密碼會立即失效' : ''}。
                    </p>
                    {detailError && <p className="text-xs text-danger font-bold">{detailError}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" disabled={manageBusy} onClick={() => { setConfirmingCancel(false); setDetailError(''); }}>返回</Button>
                      <Button variant="danger" loading={manageBusy} onClick={handleCancel}>確定取消</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => { setEditing(detail); openDetail(null); }}>
                      <Pencil size={15} /> 修改預約
                    </Button>
                    <Button variant="ghost" className="text-danger" onClick={() => setConfirmingCancel(true)}>
                      <XCircle size={15} /> 取消預約
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </Sheet>

      {editing && (
        <EditBookingSheet
          key={editing.id}
          booking={editing}
          rooms={rooms}
          canBypassSevenDays={canBypassSevenDays}
          busy={manageBusy}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  );
}

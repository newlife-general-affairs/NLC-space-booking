import { useState } from 'react';
import { Info } from 'lucide-react';
import type { Booking, Room } from '@church/shared/types';
import { Button, SelectField, Sheet, TextAreaField, TextField } from '../ui';
import { TIME_OPTIONS, getMinMaxDates } from '../bookingRules';
import type { BookingEditInput, ManageResult } from '../hooks/useBookingManage';

const VIRTUAL_ROOM_NAME = '💒 由教會分配';

const toMinutes = (t: string, isEnd = false) => {
  if (isEnd && t === '00:00') return 24 * 60;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

interface EditBookingSheetProps {
  booking: Booking;
  rooms: Room[];
  canBypassSevenDays: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: BookingEditInput) => Promise<ManageResult>;
}

/** 在原預約上直接修改日期、時段、場地、人數與用途 */
export default function EditBookingSheet({ booking, rooms, canBypassSevenDays, busy, onClose, onSubmit }: EditBookingSheetProps) {
  const [form, setForm] = useState<BookingEditInput>({
    date: booking.booking_date,
    startTime: booking.start_time.substring(0, 5),
    endTime: booking.end_time.substring(0, 5),
    roomId: booking.room_id,
    attendanceCount: booking.attendance_count || 1,
    purpose: booking.purpose || '',
  });
  const [error, setError] = useState('');

  const { minDateStr, maxDateStr } = getMinMaxDates(canBypassSevenDays, booking.booking_type);
  const roomOptions = rooms.filter(r => r.name !== VIRTUAL_ROOM_NAME || r.id === booking.room_id);
  const isApproved = booking.status === 'approved';

  const update = <K extends keyof BookingEditInput>(key: K, value: BookingEditInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.date) { setError('請選擇使用日期'); return; }
    if (toMinutes(form.endTime, true) - toMinutes(form.startTime) < 60) { setError('借用時間最少必須為 1 小時以上'); return; }
    if (!form.attendanceCount || form.attendanceCount <= 0) { setError('預計人數必須大於 0'); return; }
    const selectedRoom = rooms.find(r => r.id === form.roomId);
    if (form.attendanceCount < 15 && (selectedRoom?.capacity ?? 0) >= 50) { setError('預計人數未滿 15 人，不開放借用大空間'); return; }
    if (!form.purpose.trim()) { setError('請填寫單位及性質'); return; }
    setError('');
    const result = await onSubmit(form);
    if (!result.ok) setError(result.message);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      dismissible={!busy}
      title="修改預約"
      footer={
        <Button variant="primary" fullWidth loading={busy} onClick={handleSubmit}>
          儲存修改
        </Button>
      }
    >
      <div className="space-y-4">
        {isApproved && (
          <div className="flex gap-2 p-3 rounded-2xl bg-warning/10 text-xs text-ink-soft leading-relaxed">
            <Info size={14} className="text-warning shrink-0 mt-0.5" />
            <span>此預約已核准。更改日期、時段或場地後需要重新審核，原本的門鎖密碼也會失效；只改人數或用途則不需重審。</span>
          </div>
        )}
        {error && (
          <div className="rounded-2xl bg-danger/10 px-4 py-3 text-xs font-semibold text-danger whitespace-pre-line">{error}</div>
        )}

        <TextField
          label="使用日期" type="date" required
          min={minDateStr} max={maxDateStr}
          value={form.date}
          onChange={e => update('date', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="開始時間" required value={form.startTime} onChange={e => update('startTime', e.target.value)}>
            {TIME_OPTIONS.filter(t => t !== '00:00').map(t => <option key={t} value={t}>{t}</option>)}
          </SelectField>
          <SelectField label="結束時間" required value={form.endTime} onChange={e => update('endTime', e.target.value)}>
            {TIME_OPTIONS.filter(t => t !== '06:00').map(t => <option key={t} value={t}>{t === '00:00' ? '24:00' : t}</option>)}
          </SelectField>
        </div>
        <SelectField label="場地" required value={form.roomId} onChange={e => update('roomId', Number(e.target.value))}>
          {roomOptions.map(r => (
            <option key={r.id} value={r.id}>{r.name}{r.capacity ? `（${r.capacity} 人）` : ''}</option>
          ))}
        </SelectField>
        <TextField
          label="預計人數" required type="number" min="1"
          value={form.attendanceCount}
          onChange={e => update('attendanceCount', parseInt(e.target.value) || 0)}
        />
        <TextAreaField
          label="單位及性質" required rows={3}
          value={form.purpose}
          onChange={e => update('purpose', e.target.value)}
        />
      </div>
    </Sheet>
  );
}

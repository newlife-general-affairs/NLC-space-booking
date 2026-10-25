import { useMemo, useState, useEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Calendar, CheckCircle2, ChevronLeft, Building2, Users, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Room, BookingFormState, BookingSlot } from '@church/shared/types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { apiFetchPastorStatus } from '@church/shared/api';
import { Button, TextAreaField, TextField } from '../ui';
import { TIME_OPTIONS, getMinMaxDates } from '../bookingRules';

// ── Time Grid Selector ──────────────────────────────────────────────────
interface TimeGridSelectorProps {
  startTime: string;
  endTime: string;
  onChange: (start: string, end: string) => void;
}

function TimeGridSelector({ startTime, endTime, onChange }: TimeGridSelectorProps) {
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [tapStart, setTapStart] = useState<string | null>(null);
  // 按下後真的移到別格才算拖曳；拖曳結束若落在按鈕上會再觸發 click，要略過以免被當成點選
  const draggedRef = useRef(false);

  const timeToMin = (t: string) => {
    if (t === '00:00' || t === '24:00') return 24 * 60;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const getNextTimeSlot = (timeStr: string) => {
    const min = timeToMin(timeStr);
    const nextMin = min + 15;
    const nextH = Math.floor(nextMin / 60);
    const nextM = nextMin % 60;
    if (nextH >= 24) return '00:00';
    return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
  };

  const blocks = useMemo(() => TIME_OPTIONS.filter(t => t !== '00:00'), []);
  const startMin = startTime ? timeToMin(startTime) : null;
  const endMin = endTime ? timeToMin(endTime) : null;

  const handleBlockSelect = (time: string) => {
    const timeMin = timeToMin(time);
    if (!tapStart) {
      setTapStart(time);
      onChange(time, getNextTimeSlot(time));
    } else {
      const firstMin = timeToMin(tapStart);
      if (timeMin === firstMin) {
        setTapStart(null);
        onChange('', '');
      } else if (timeMin < firstMin) {
        onChange(time, getNextTimeSlot(tapStart));
        setTapStart(null);
      } else {
        onChange(tapStart, getNextTimeSlot(time));
        setTapStart(null);
      }
    }
  };

  // 只記錄拖曳起點；單純點擊交給 onClick 處理（手機點擊也會先觸發 mousedown，在這裡選取會被接著的 click 當成再點一次而取消）
  const handleMouseDown = (time: string, e: MouseEvent) => {
    if (e.button !== 0) return;
    setDragStart(time);
    draggedRef.current = false;
  };

  const handleMouseEnter = (time: string) => {
    if (!dragStart || (time === dragStart && !draggedRef.current)) return;
    draggedRef.current = true;
    setTapStart(null);
    const startM = timeToMin(dragStart);
    const currM = timeToMin(time);
    if (currM < startM) onChange(time, getNextTimeSlot(dragStart));
    else onChange(dragStart, getNextTimeSlot(time));
  };

  const handleClick = (time: string) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    handleBlockSelect(time);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setDragStart(null);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const groupedBlocks = useMemo(() => {
    const groups: Record<number, string[]> = {};
    blocks.forEach(t => {
      const h = parseInt(t.split(':')[0]);
      if (!groups[h]) groups[h] = [];
      groups[h].push(t);
    });
    return groups;
  }, [blocks]);

  return (
    <div className="space-y-3 bg-surface-sunken rounded-2xl p-3.5 select-none">
      <div className="flex items-center justify-between text-xs text-ink-soft gap-2 pb-2 border-b border-border">
        <span className="flex items-center gap-1.5">
          <Info size={13} className="text-primary shrink-0" />
          <span>點選首尾兩點來選取時段</span>
        </span>
        {startTime && endTime && (
          <span className="font-bold text-primary bg-primary-soft px-2 py-0.5 rounded-lg shrink-0">
            {startTime}–{endTime}
          </span>
        )}
      </div>

      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {Object.entries(groupedBlocks).map(([hourStr, hrBlocks]) => {
          const hr = parseInt(hourStr);
          return (
            <div key={hr} className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-ink-faint w-10 text-right shrink-0">{String(hr).padStart(2, '0')}:00</span>
              <div className="flex-1 grid grid-cols-4 gap-1">
                {hrBlocks.map(t => {
                  const m = t.split(':')[1];
                  const blockMin = timeToMin(t);
                  const isSelected = startMin !== null && endMin !== null && blockMin >= startMin && blockMin < endMin;
                  const isTapStart = tapStart === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onMouseDown={(e) => handleMouseDown(t, e)}
                      onMouseEnter={() => handleMouseEnter(t)}
                      onClick={() => handleClick(t)}
                      data-no-debounce="true"
                      className={`h-9 rounded-md text-[11px] font-bold border transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-primary border-primary text-primary-ink'
                          : isTapStart
                          ? 'bg-primary-soft border-primary/60 text-primary'
                          : 'bg-surface border-border text-ink-faint'
                      }`}
                      title={t}
                    >
                      :{m}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step chrome ──────────────────────────────────────────────────────────
function StepHeader({ step, total, title, onBack, backLabel }: { step: number; total: number; title: string; onBack: () => void; backLabel: string }) {
  return (
    <div className="sticky top-11 z-30 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-ink-soft active:scale-95 transition-transform">
          <ChevronLeft size={16} /> {backLabel}
        </button>
        <span className="text-xs font-bold text-ink-faint">{step}／{total}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-surface-sunken'}`} />
        ))}
      </div>
      <h2 className="mt-3 text-lg font-black text-ink">{title}</h2>
    </div>
  );
}

// 放在底部導覽列（.mobile-app-nav，高 65px＋安全區域）正上方，避免被蓋住；安全區域由導覽列處理
function StickyFooter({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-[calc(65px+env(safe-area-inset-bottom))] left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border px-4 py-3">
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}

// ── BookingPage ────────────────────────────────────────────────────────
interface BookingPageProps {
  getToken?: () => string;
  currentBranch: string | null;
  isAdmin: boolean;
  rooms: Room[];
  bookingStarted: boolean;
  bookingStep: number;
  bookingState: BookingFormState;
  bookingSubmitting: boolean;
  selectedRooms: Room[];
  roomPurposes: Record<number, string>;
  onSelectRooms: (rooms: Room[]) => void;
  onRoomPurposesChange: (purposes: Record<number, string>) => void;
  roomAvailability: Record<number, boolean>;
  onStart: () => void;
  onStepChange: (step: number) => void;
  onBookingStateChange: (state: BookingFormState) => void;
  onConfirm: () => void;
  onBack?: () => void;
}

const BOOKING_TYPES = [
  { value: '一般借用', label: '一般借用', desc: '單一場地的日常借用申請' },
  { value: '婚禮', label: '婚禮', desc: '可選多個場地組合' },
  { value: '重要', label: '重要活動', desc: '可選多個場地組合' },
];

export default function BookingPage({
  getToken,
  isAdmin, rooms,
  bookingStep,
  bookingState, bookingSubmitting,
  selectedRooms, roomAvailability,
  roomPurposes,
  onStepChange, onBookingStateChange, onSelectRooms, onRoomPurposesChange, onConfirm, onBack,
}: BookingPageProps) {
  const { minDateStr, maxDateStr } = getMinMaxDates(isAdmin, bookingState.bookingType);
  const [suspendedMonths, setSuspendedMonths] = useState<string[]>([]);
  const isOnline = useOnlineStatus();

  const uniqueMonths = useMemo(() => Array.from(new Set(
    bookingState.slots.map(s => s.date).filter(Boolean).map(d => d.substring(0, 7))
  )), [bookingState.slots]);

  useEffect(() => {
    if (!bookingState.pastoralZone || uniqueMonths.length === 0 || isAdmin || !getToken) {
      setSuspendedMonths([]);
      return;
    }
    const checkSuspensions = async () => {
      try {
        const results = await Promise.all(
          uniqueMonths.map(async (monthStr) => {
            const res = await apiFetchPastorStatus(getToken(), bookingState.pastoralZone, `${monthStr}-01`);
            return { month: monthStr, suspended: res.suspended };
          })
        );
        setSuspendedMonths(results.filter(r => r.suspended).map(r => r.month));
      } catch (err) {
        console.error('Check suspension error:', err);
      }
    };
    checkSuspensions();
  }, [bookingState.pastoralZone, uniqueMonths, isAdmin, getToken]);

  // 一次合併多個欄位：onBookingStateChange 是以目前的 bookingState 組新物件，連續呼叫兩次後者會蓋掉前者
  const updateSlot = (id: string, patch: Partial<BookingSlot>) => {
    onBookingStateChange({ ...bookingState, slots: bookingState.slots.map(s => s.id === id ? { ...s, ...patch } : s) });
  };
  const addSlot = () => {
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    onBookingStateChange({ ...bookingState, slots: [...bookingState.slots, { id: newId, date: '', startTime: '', endTime: '' }] });
  };
  const removeSlot = (id: string) => {
    onBookingStateChange({ ...bookingState, slots: bookingState.slots.filter(s => s.id !== id) });
  };

  const roomsByFloor = (Array.isArray(rooms) ? rooms : []).reduce((acc, room) => {
    const floor = room.name?.includes('-') ? room.name.split('-')[0] : '其他';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<string, Room[]>);

  const isSpecial = bookingState.bookingType === '婚禮' || bookingState.bookingType === '重要';
  const hasCompleteSlot = bookingState.slots.length > 0 && bookingState.slots.every(s => s.date && s.startTime && s.endTime);
  const totalSteps = 6;
  const submitBlocked = !isOnline || bookingSubmitting || (!isAdmin && suspendedMonths.length > 0);

  const [error, setError] = useState('');
  const goNext = (validate: () => string | null, next: number) => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    onStepChange(next);
  };

  const backLabel = bookingStep === 1 ? (onBack ? '返回首頁' : '返回') : '上一步';
  const handleBack = () => {
    if (bookingStep === 1) { onBack?.(); return; }
    onStepChange(bookingStep - 1);
  };

  return (
    <div className="pb-28">
      <StepHeader
        step={Math.min(bookingStep, totalSteps)}
        total={totalSteps}
        title={
          bookingStep === 1 ? '選擇借用類型'
            : bookingStep === 2 ? '借用人資料'
            : bookingStep === 3 ? '選擇日期與時段'
            : bookingStep === 4 ? '選擇場地'
            : bookingStep === 5 ? '用途說明'
            : '確認送出'
        }
        onBack={handleBack}
        backLabel={backLabel}
      />

      {!isOnline && (
        <div className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger text-center">
          網路已斷線，預約送出可能失敗，請檢查網路連線。
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-xs font-semibold text-danger whitespace-pre-line">{error}</div>
      )}

      <AnimatePresence mode="wait">
        {/* Step 1: 借用類型 */}
        {bookingStep === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="mt-4 space-y-2.5">
            {BOOKING_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { onBookingStateChange({ ...bookingState, bookingType: t.value }); onStepChange(2); }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${bookingState.bookingType === t.value ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}
              >
                <div className="font-black text-ink text-sm">{t.label}</div>
                <div className="text-xs text-ink-soft mt-0.5">{t.desc}</div>
              </button>
            ))}
          </motion.div>
        )}

        {/* Step 2: 借用人資料 */}
        {bookingStep === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="mt-4 space-y-4">
            <TextField label="借用人姓名" required value={bookingState.fullName} onChange={e => onBookingStateChange({ ...bookingState, fullName: e.target.value })} placeholder="您的真實姓名" />
            <TextField label="聯絡電話" required type="tel" value={bookingState.phone} onChange={e => onBookingStateChange({ ...bookingState, phone: e.target.value })} placeholder="聯絡電話" />
            <TextField label="所屬牧區" required value={bookingState.pastoralZone} onChange={e => onBookingStateChange({ ...bookingState, pastoralZone: e.target.value })} placeholder="例如：大專青年區" />
            <TextField
              label="預計人數" required type="number" min="1"
              value={bookingState.attendanceCount}
              onChange={e => onBookingStateChange({ ...bookingState, attendanceCount: parseInt(e.target.value) || 0 })}
            />
          </motion.div>
        )}

        {/* Step 3: 日期與時段 */}
        {bookingStep === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="mt-4 space-y-4">
            {suspendedMonths.length > 0 && (
              <div className="p-4 bg-danger/10 rounded-2xl">
                <h4 className="font-black text-danger text-sm">停權警告：牧區資格已取消</h4>
                <p className="text-xs text-danger mt-1 leading-relaxed">
                  您的所屬牧區「{bookingState.pastoralZone}」已取消在 {suspendedMonths.join('、')} 月份的場地借用申請資格。
                </p>
              </div>
            )}

            {bookingState.slots.map((slot, index) => (
              <div key={slot.id} className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="badge-brand">時段 {index + 1}</span>
                  {bookingState.slots.length > 1 && (
                    <button onClick={() => removeSlot(slot.id)} className="text-danger text-xs font-bold">移除</button>
                  )}
                </div>
                <TextField
                  label="使用日期" type="date" required
                  min={minDateStr} max={maxDateStr}
                  value={slot.date}
                  onChange={e => updateSlot(slot.id, { date: e.target.value })}
                />
                {slot.date && (
                  <TimeGridSelector
                    startTime={slot.startTime}
                    endTime={slot.endTime}
                    onChange={(start, end) => updateSlot(slot.id, { startTime: start, endTime: end })}
                  />
                )}
              </div>
            ))}

            <button type="button" onClick={addSlot} data-no-debounce="true" className="w-full py-3 border-2 border-dashed border-border rounded-2xl text-ink-faint font-bold text-xs">
              ＋ 新增另一個借用時段
            </button>
          </motion.div>
        )}

        {/* Step 4: 選擇場地 */}
        {bookingStep === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="mt-4 space-y-6">
            <p className="text-xs text-ink-soft flex items-center gap-1.5">
              <Building2 size={14} className="text-primary shrink-0" />
              {isSpecial ? '可多選多個場地進行組合' : '請點擊下方場地選取'}
            </p>
            {Object.entries(roomsByFloor).map(([floor, floorRooms]) => (
              <div key={floor} className="space-y-2.5">
                <h4 className="section-label pl-1">{floor} 樓</h4>
                <div className="space-y-2.5">
                  {floorRooms.map(room => {
                    const isAvailable = roomAvailability[room.id] !== false;
                    const isTooSmall = bookingState.attendanceCount < 15 && room.capacity >= 50;
                    const isDisabled = isTooSmall || (!isAvailable && hasCompleteSlot);
                    const isSelected = selectedRooms.some(r => r.id === room.id);
                    return (
                      <button
                        key={room.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isSpecial) {
                            onSelectRooms(isSelected ? selectedRooms.filter(r => r.id !== room.id) : [...selectedRooms, room]);
                          } else {
                            onSelectRooms([room]);
                          }
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-colors disabled:opacity-40 ${
                          isSelected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'
                        }`}
                      >
                        <img src={room.image_url || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=200&q=60'} alt={room.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-ink text-sm truncate">{room.name}</div>
                          <div className="flex items-center gap-1 text-xs text-ink-faint mt-0.5"><Users size={12} /> {room.capacity} 人</div>
                          {isDisabled && (
                            <div className="text-[10px] font-bold text-danger mt-1">{isTooSmall ? '人數不足，不開放大空間' : '時段已被預訂'}</div>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 size={20} className="text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Step 5: 用途說明 */}
        {bookingStep === 5 && (
          <motion.div key="s5" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="mt-4 space-y-4">
            {isSpecial ? (
              selectedRooms.map(room => (
                <TextAreaField
                  key={room.id}
                  label={`${room.name} 的用途`}
                  required
                  value={roomPurposes[room.id] || ''}
                  onChange={e => onRoomPurposesChange({ ...roomPurposes, [room.id]: e.target.value })}
                  placeholder="請填寫該場地的詳細用途（如：新娘化妝室、主堂彩排...）"
                  rows={3}
                />
              ))
            ) : (
              <TextAreaField
                label="單位及性質"
                required
                value={bookingState.purpose}
                onChange={e => onBookingStateChange({ ...bookingState, purpose: e.target.value })}
                placeholder="例如：小組敬拜練習、同工會議"
                rows={4}
              />
            )}
          </motion.div>
        )}

        {/* Step 6: 確認送出 */}
        {bookingStep === 6 && (
          <motion.div key="s6" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="mt-4 space-y-4">
            <div className="card p-4 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-ink-soft">借用類型</span><span className="font-bold text-ink">{bookingState.bookingType}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink-soft">借用人</span><span className="font-bold text-ink">{bookingState.fullName}（{bookingState.phone}）</span></div>
              <div className="divider" />
              {bookingState.slots.map(s => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span className="text-ink-soft flex items-center gap-1"><Calendar size={13} />{s.date}</span>
                  <span className="font-bold text-ink">{s.startTime}–{s.endTime}</span>
                </div>
              ))}
              <div className="divider" />
              <div className="text-sm"><span className="text-ink-soft">場地：</span><span className="font-bold text-ink">{selectedRooms.map(r => r.name).join('、')}</span></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sticky CTA ── */}
      <StickyFooter>
        {bookingStep === 1 && <div className="text-center text-xs text-ink-faint py-2">請選擇上方任一借用類型繼續</div>}

        {bookingStep === 2 && (
          <Button variant="primary" fullWidth onClick={() => goNext(() => {
            if (!bookingState.fullName || !bookingState.phone || !bookingState.pastoralZone) return '請填寫借用人姓名、聯絡電話與所屬牧區';
            if (!bookingState.attendanceCount || bookingState.attendanceCount <= 0) return '預計人數必須大於 0';
            return null;
          }, 3)}>下一步：選擇日期與時段</Button>
        )}

        {bookingStep === 3 && (
          <Button variant="primary" fullWidth onClick={() => goNext(() => hasCompleteSlot ? null : '請至少完整填寫一個借用時段', 4)}>下一步：選擇場地</Button>
        )}

        {bookingStep === 4 && (
          <Button variant="primary" fullWidth disabled={selectedRooms.length === 0} onClick={() => goNext(() => selectedRooms.length === 0 ? '請選擇至少一個場地' : null, 5)}>
            下一步：填寫用途
          </Button>
        )}

        {bookingStep === 5 && (
          <Button variant="primary" fullWidth onClick={() => goNext(() => {
            if (isSpecial) {
              const missing = selectedRooms.some(r => !roomPurposes[r.id]?.trim());
              return missing ? '請填寫每個場地的用途說明' : null;
            }
            return bookingState.purpose?.trim() ? null : '請填寫單位及性質';
          }, 6)}>下一步：確認送出</Button>
        )}

        {bookingStep === 6 && (
          <Button variant="primary" fullWidth disabled={submitBlocked} onClick={onConfirm} loading={bookingSubmitting}>
            {!isOnline ? '網路斷線中，無法送出'
              : !isAdmin && suspendedMonths.length > 0 ? '停權中，無法提交預約'
              : bookingSubmitting ? '發送預約中…' : '確認送出預約'}
          </Button>
        )}
      </StickyFooter>
    </div>
  );
}

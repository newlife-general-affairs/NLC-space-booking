import { useState, useEffect, useRef } from 'react';
import type { Room, BookingFormState, StatusMsg, BookingCreatePayload } from '@church/shared/types';
import { apiCheckAvailability, apiCreateBooking, apiSaveProfile } from '@church/shared/api';
import { bookingDraftService } from '../services/booking/BookingDraftService';
import type { MemberTab } from '../navigation';

const DEFAULT_BOOKING_STATE: BookingFormState = {
  slots: [{ id: '1', date: '', startTime: '', endTime: '' }],
  fullName: '',
  phone: '',
  pastoralZone: '',
  purpose: '',
  bookingType: '一般借用',
  attendanceCount: 0,
};

interface UseBookingOptions {
  rooms: Room[];
  currentBranch: string | null;
  isAdmin: boolean;
  userEmail?: string;
  getToken: () => string;
  onSuccess: (tab: MemberTab) => void;
  onProfileAutoSaved?: (profile: { fullName: string; phone: string; pastoralZone: string }) => void;
}

export function useBooking({ rooms, currentBranch, isAdmin, userEmail, getToken, onSuccess, onProfileAutoSaved }: UseBookingOptions) {
  const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
  const [roomPurposes, setRoomPurposes] = useState<Record<number, string>>({});
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingStarted, setBookingStarted] = useState(false);
  const [bookingState, setBookingState] = useState<BookingFormState>(DEFAULT_BOOKING_STATE);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMsg>({ type: '', text: '' });
  const [roomAvailability, setRoomAvailability] = useState<Record<number, boolean>>({});
  const draftKey = userEmail && currentBranch
    ? bookingDraftService.createKey(userEmail, currentBranch)
    : undefined;
  const draftHydratedRef = useRef(false);
  const pendingSelectedRoomIdsRef = useRef<number[]>([]);

  useEffect(() => {
    draftHydratedRef.current = false;
    if (!draftKey) return;

    let active = true;
    bookingDraftService.load(draftKey)
      .then((draft) => {
        if (!active || !draft) return;
        // 舊版「取消或異動」流程已移除（改在借用紀錄直接修改），留下的草稿直接丟棄
        if (draft.form.bookingType === '取消或異動') {
          void bookingDraftService.clear(draftKey);
          return;
        }
        setBookingState(draft.form);
        setRoomPurposes(draft.roomPurposes);
        setBookingStep(draft.bookingStep);
        setBookingStarted(draft.bookingStarted);
        pendingSelectedRoomIdsRef.current = draft.selectedRoomIds;
      })
      .catch((error) => console.error('Loading booking draft failed:', error))
      .finally(() => {
        if (active) draftHydratedRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [draftKey]);

  useEffect(() => {
    const pendingIds = pendingSelectedRoomIdsRef.current;
    if (!draftHydratedRef.current || pendingIds.length === 0 || rooms.length === 0) return;
    const restoredRooms = rooms.filter((room) => pendingIds.includes(room.id));
    if (restoredRooms.length > 0) {
      setSelectedRooms(restoredRooms);
      pendingSelectedRoomIdsRef.current = [];
    }
  }, [rooms]);

  useEffect(() => {
    if (!draftKey || !draftHydratedRef.current || !bookingStarted) return;

    const timer = window.setTimeout(() => {
      void bookingDraftService.save({
        key: draftKey,
        form: bookingState,
        selectedRoomIds: selectedRooms.map((room) => room.id),
        roomPurposes,
        bookingStep,
        bookingStarted,
      }).catch((error) => console.error('Saving booking draft failed:', error));
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    draftKey,
    bookingState,
    selectedRooms,
    roomPurposes,
    bookingStep,
    bookingStarted,
  ]);

  // 有效時段改變時，自動檢查可用性
  useEffect(() => {
    const validSlots = bookingState.slots.filter(s => s.date && s.startTime && s.endTime);
    if (validSlots.length === 0) {
      setRoomAvailability({});
      return;
    }

    const checkAllAvailability = async () => {
      try {
        const results = await Promise.all(
          validSlots.map(s => apiCheckAvailability(s.date, s.startTime, s.endTime))
        );
        const allBookedIds = new Set<number>();
        results.forEach(ids => {
          if (Array.isArray(ids)) ids.forEach(id => allBookedIds.add(id));
        });
        const availability: Record<number, boolean> = {};
        rooms.forEach(r => { availability[r.id] = !allBookedIds.has(r.id); });
        setRoomAvailability(availability);
      } catch (err) {
        console.error('Check availability error:', err);
      }
    };

    checkAllAvailability();
  }, [bookingState.slots, rooms]);

  const prefillProfile = (profile: { full_name?: string; phone?: string; pastoral_zone?: string }) => {
    setBookingState(prev => ({
      ...prev,
      fullName: profile.full_name || prev.fullName,
      phone: profile.phone || prev.phone,
      pastoralZone: profile.pastoral_zone || prev.pastoralZone,
    }));
  };

  const startBookingFromCalendar = (date?: string, roomId?: number) => {
    setBookingState(prev => ({
      ...prev,
      slots: [{ id: '1', date: date || '', startTime: '', endTime: '' }],
    }));
    const room = roomId ? rooms.find(r => r.id === roomId) : null;
    setSelectedRooms(room ? [room] : []);
    setRoomPurposes({});
    setBookingStep(1);
    setBookingStarted(true);
  };

  const handleBooking = async () => {
    if (bookingSubmitting || selectedRooms.length === 0) return;

    const missingFields = [];
    if (!bookingState.fullName) missingFields.push('借用人姓名');
    if (!bookingState.phone) missingFields.push('聯絡電話');
    if (!bookingState.pastoralZone) missingFields.push('所屬牧區');

    const isSpecial = bookingState.bookingType === '婚禮' || bookingState.bookingType === '重要';
    if (!isSpecial && !bookingState.purpose) {
      missingFields.push('單位及性質');
    }

    if (bookingState.slots.some(s => !s.date || !s.startTime || !s.endTime)) {
      setStatusMsg({ type: 'error', text: '❌ 請填寫所有已新增借用時段的日期與時間！' });
      return;
    }
    if (missingFields.length > 0) {
      setStatusMsg({ type: 'error', text: `請填寫或選擇以下必填項目：${missingFields.join('、')}` });
      return;
    }

    if (typeof bookingState.attendanceCount !== 'number' || bookingState.attendanceCount <= 0) {
      setStatusMsg({ type: 'error', text: '❌ 預計人數必須大於 0！' });
      return;
    }

    if (isSpecial) {
      const emptyPurposeRooms = selectedRooms.filter(r => !roomPurposes[r.id]?.trim());
      if (emptyPurposeRooms.length > 0) {
        setStatusMsg({ type: 'error', text: `❌ 請填寫所有選取場地（${emptyPurposeRooms.map(r => r.name).join('、')}）的使用內容！` });
        return;
      }
    }

    // 前端時段驗證
    for (const s of bookingState.slots) {
      const startMins = parseInt(s.startTime.split(':')[0]) * 60 + parseInt(s.startTime.split(':')[1]);
      let endMins = parseInt(s.endTime.split(':')[0]) * 60 + parseInt(s.endTime.split(':')[1]);
      if (s.endTime === '00:00') endMins = 24 * 60;

      if (endMins - startMins < 60) {
        setStatusMsg({ type: 'error', text: `❌ 時段 ${s.date} ${s.startTime}-${s.endTime}：借用時間最少必須為 1 小時以上` });
        return;
      }

      if (!isAdmin) {
        const [yr, mo, dy] = s.date.split('-').map(Number);
        const bookingTime = new Date(yr, mo - 1, dy).getTime();
        const todayTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
        if ((bookingTime - todayTime) < 7 * 24 * 60 * 60 * 1000) {
          setStatusMsg({ type: 'error', text: `❌ 時段 ${s.date}：新增或異動借用需在一週（7天）前申請。` });
          return;
        }
      }

      const [yr, mo, dy] = s.date.split('-').map(Number);
      const dayOfWeek = new Date(yr, mo - 1, dy).getDay();
      
      const isVirtual = selectedRooms.some(r => r.name === '💒 由教會分配');
      const isSulin = selectedRooms.some(r => r.branch === '士林堂');

      if (isSulin && !isVirtual) {
        const isValidSlot =
          (dayOfWeek === 3 && startMins >= 19 * 60 && endMins <= 21 * 60 + 30) ||
          (dayOfWeek === 4 && startMins >= 19 * 60 && endMins <= 21 * 60 + 30) ||
          (dayOfWeek === 6 && startMins >= 10 * 60 && endMins <= 18 * 60);
        if (!isValidSlot) {
          setStatusMsg({ type: 'error', text: `❌ 時段 ${s.date} ${s.startTime}-${s.endTime}：士林會堂常規借用僅限：週三 19:00-21:30、週四 19:00-21:30、週六 10:00-18:00。` });
          return;
        }
      } else {
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          if (startMins < 6 * 60 + 30 || endMins > 22 * 60 + 30) {
            setStatusMsg({ type: 'error', text: `❌ 時段 ${s.date}：週一至週五預約時間必須在 06:30 至 22:30 之間` });
            return;
          }
        } else if (dayOfWeek === 6) {
          if (startMins < 6 * 60 + 30 || endMins > 18 * 60) {
            setStatusMsg({ type: 'error', text: `❌ 時段 ${s.date}：週六預約時間必須在 06:30 至 18:00 之間 (包含晨間時段)` });
            return;
          }
        } else if (dayOfWeek === 0) {
          if (startMins < 6 * 60 + 30 || endMins > 17 * 60 + 30) {
            setStatusMsg({ type: 'error', text: `❌ 時段 ${s.date}：週日預約時間必須在 06:30 至 17:30 之間 (包含晨間時段)` });
            return;
          }
        }
      }
    if (!navigator.onLine) {
      setStatusMsg({
        type: 'error',
        text: '網路已斷線，請檢查網路連線',
      });
      return;
    }
    }

    setBookingSubmitting(true);
    const availabilityResults = await Promise.all(
      bookingState.slots.map((slot) =>
        apiCheckAvailability(slot.date, slot.startTime, slot.endTime),
      ),
    );
    const bookedRoomIds = new Set(availabilityResults.flat());
    const conflictingRooms = selectedRooms.filter((room) => bookedRoomIds.has(room.id));
    if (conflictingRooms.length > 0) {
      setStatusMsg({
        type: 'error',
        text: `❌ 場地「${conflictingRooms.map((room) => room.name).join('、')}」在此時段已被預約！`,
      });
      return;
    }
    try {
      const payload: BookingCreatePayload = {
        slots: bookingState.slots,
        fullName: bookingState.fullName,
        phone: bookingState.phone,
        pastoralZone: bookingState.pastoralZone,
        bookingType: bookingState.bookingType,
        attendanceCount: bookingState.attendanceCount,
      };

      if (isSpecial) {
        payload.rooms = selectedRooms.map(r => ({
          roomId: r.id,
          purpose: roomPurposes[r.id] || '',
        }));
      } else {
        payload.roomId = selectedRooms[0].id;
        payload.purpose = bookingState.purpose;
      }

      const res = await apiCreateBooking(getToken(), payload);
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: data.message || `🎉 預約成功！已寄發確認信至 ${userEmail}` });

        // 自動將在此次填寫的聯絡資料存為常用資料
        apiSaveProfile(getToken(), {
          fullName: bookingState.fullName,
          phone: bookingState.phone,
          pastoralZone: bookingState.pastoralZone,
        })
          .then((profileRes) => {
            if (profileRes.ok) {
              onProfileAutoSaved?.({
                fullName: bookingState.fullName,
                phone: bookingState.phone,
                pastoralZone: bookingState.pastoralZone,
              });
            }
          })
          .catch((err) => console.error('Auto-saving profile failed:', err));

        if (draftKey) void bookingDraftService.clear(draftKey);
        setSelectedRooms([]);
        setRoomPurposes({});
        setBookingState({
          ...DEFAULT_BOOKING_STATE,
          fullName: bookingState.fullName,
          phone: bookingState.phone,
          pastoralZone: bookingState.pastoralZone,
        });
        setBookingStep(1);
        setBookingStarted(false);
        onSuccess('me');
      } else {
        setStatusMsg({ type: 'error', text: data.error });
      }
    } catch {
      setStatusMsg({ type: 'error', text: '網路錯誤，請稍後再試' });
    } finally {
      setBookingSubmitting(false);
    }
  };

  return {
    selectedRooms, setSelectedRooms,
    roomPurposes, setRoomPurposes,
    bookingStep, setBookingStep,
    bookingStarted, setBookingStarted,
    bookingState, setBookingState,
    bookingSubmitting,
    statusMsg, setStatusMsg,
    roomAvailability,
    prefillProfile,
    startBookingFromCalendar,
    handleBooking,
  };
}

const BaseBlock = require('./BaseBlock');
const BookingError = require('./BookingError');
const { supabase } = require('../database');

/**
 * TimingPolicyBlock
 * 
 * Enforces all calendar-related policies:
 * 1. Checks 15-min increment rule.
 * 2. Fetches target rooms and verifies their existence.
 * 3. Enforces date limits (past dates,当月/下月 restriction, 15th-of-month window opening).
 * 4. Enforces 7-day advance booking constraint for non-admins.
 * 5. Enforces minimum 1-hour duration.
 * 6. Enforces Sulin Branch (士林堂) specific booking hours.
 * 7. Enforces standard church opening hours for all other branches.
 */
class TimingPolicyBlock extends BaseBlock {
  async execute(context) {
    const { slots, user, cleanFields, roomsToBook } = context;
    const userRole = user.role;
    const bookingType = cleanFields.bookingType;

    // Helper: Validates 15-minute increments
    const isValidTimeFormat = (t) => {
      if (!t || !t.includes(':')) return false;
      const mins = t.split(':')[1];
      return ['00', '15', '30', '45'].includes(mins);
    };

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!isValidTimeFormat(s.startTime) || !isValidTimeFormat(s.endTime)) {
        throw new BookingError(`時段 ${s.date} ${s.startTime}-${s.endTime} 必須以 15 分鐘為單位（例如 10:00, 10:15）`, 400);
      }
    }

    // Fetch and check target rooms
    const targetRoomIds = roomsToBook.map(r => r.roomId);
    const { data: targetRooms, error: roomsErr } = await supabase
      .from('rooms')
      .select('id, name, branch')
      .in('id', targetRoomIds);

    if (roomsErr || !targetRooms || targetRooms.length !== targetRoomIds.length) {
      throw new BookingError('找不到指定的場地', 400);
    }
    context.targetRooms = targetRooms;

    // Setup date limits
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cYear = now.getFullYear();
    const cMonth = now.getMonth();
    const cDate = now.getDate();

    let nextMonth = cMonth + 1;
    let nextYear = cYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear = cYear + 1;
    }

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      
      // Parse slot date
      const [yr, mo, dy] = s.date.split('-').map(Number);
      const bookingDate = new Date(yr, mo - 1, dy);

      if (bookingDate < today) {
        throw new BookingError(`時段 ${s.date}：無法預約過去的日期`, 400);
      }

      // Special booking types (Wedding, Important events) bypass current/next month window limits
      const isSpecialBooking = bookingType === '婚禮' || bookingType === '重要';
      if (!isSpecialBooking) {
        const bYear = bookingDate.getFullYear();
        const bMonth = bookingDate.getMonth();
        const isCurrentMonth = bYear === cYear && bMonth === cMonth;
        const isNextMonth = bYear === nextYear && bMonth === nextMonth;

        if (isNextMonth) {
          if (cDate < 15) {
            throw new BookingError(`時段 ${s.date}：每月15號起才開放預約下個月份的場地`, 403);
          }
        } else if (!isCurrentMonth) {
          throw new BookingError(`時段 ${s.date}：目前僅開放預約當月或下個月的場地`, 403);
        }
      }

      // Check user role 7-day advance booking constraint
      if (userRole === 'user') {
        const bookingTime = bookingDate.getTime();
        const todayTime = today.getTime();
        if ((bookingTime - todayTime) < 7 * 24 * 60 * 60 * 1000) {
          throw new BookingError(`時段 ${s.date}：新增或異動借用需在一週（7天）前申請。臨時借用請洽管理單位或值班人員。`, 400);
        }
      }

      // Check duration (Minimum 1 hour)
      const startMins = parseInt(s.startTime.split(':')[0]) * 60 + parseInt(s.startTime.split(':')[1]);
      let endMins = parseInt(s.endTime.split(':')[0]) * 60 + parseInt(s.endTime.split(':')[1]);
      if (s.endTime === '00:00') {
        endMins = 24 * 60;
      }

      if (endMins - startMins < 60) {
        throw new BookingError(`時段 ${s.date}：借用時間最少必須為 1 小時以上`, 400);
      }

      // Check opening hours per room branch
      const dayOfWeek = bookingDate.getDay();
      for (const r of targetRooms) {
        const isVirtual = r.name === '💒 由教會分配';
        const isSulin = r.branch === '士林堂';

        if (isSulin && !isVirtual) {
          let isValidSlot = false;
          if (dayOfWeek === 3 && startMins >= 19 * 60 && endMins <= 21 * 60 + 30) {
            isValidSlot = true;
          } else if (dayOfWeek === 4 && startMins >= 19 * 60 && endMins <= 21 * 60 + 30) {
            isValidSlot = true;
          } else if (dayOfWeek === 6 && startMins >= 10 * 60 && endMins <= 18 * 60) {
            isValidSlot = true;
          }

          if (!isValidSlot) {
            throw new BookingError(
              `時段 ${s.date} ${s.startTime}-${s.endTime}：士林會堂常規借用僅限：週三 19:00-21:30、週四 19:00-21:30、週六 10:00-18:00。非上述時段，請選擇「💒 由教會分配」提出特別申請。`,
              400
            );
          }
        } else {
          // Standard hours for other locations
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            if (startMins < 6 * 60 + 30 || endMins > 22 * 60 + 30) {
              throw new BookingError(`時段 ${s.date}：週一至週五預約時間必須在 06:30 至 22:30 之間 (包含晨禱 06:30-08:00)`, 400);
            }
          } else if (dayOfWeek === 6) {
            if (startMins < 6 * 60 + 30 || endMins > 18 * 60) {
              throw new BookingError(`時段 ${s.date}：週六預約時間必須在 06:30 至 18:00 之間 (包含晨間時段 06:30-08:00)`, 400);
            }
          } else if (dayOfWeek === 0) {
            if (startMins < 6 * 60 + 30 || endMins > 17 * 60 + 30) {
              throw new BookingError(`時段 ${s.date}：週日預約時間必須在 06:30 至 17:30 之間 (包含晨間時段 06:30-08:00)`, 400);
            }
          }
        }
      }
    }
  }
}

module.exports = TimingPolicyBlock;

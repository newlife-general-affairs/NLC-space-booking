/**
 * violationsStore.js
 *
 * 違規紀錄管理模組 — 使用 Supabase `violations` 資料表持久化儲存
 *
 * 資料結構（violations 表）：
 *   id            BIGSERIAL   PRIMARY KEY
 *   booking_id    BIGINT      REFERENCES bookings(id) ON DELETE SET NULL
 *   pastoral_zone TEXT        NOT NULL
 *   booking_date  DATE        NOT NULL
 *   start_time    TEXT
 *   end_time      TEXT
 *   room_name     TEXT
 *   branch        TEXT        NOT NULL
 *   full_name     TEXT
 *   phone         TEXT
 *   user_email    TEXT
 *   purpose       TEXT
 *   violation_type TEXT       NOT NULL DEFAULT 'manual'
 *   points        INTEGER     NOT NULL DEFAULT 0
 *   reason        TEXT        NOT NULL DEFAULT '未完整復歸場地'
 *   is_cancelled  BOOLEAN     NOT NULL DEFAULT FALSE
 *   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
 */

const { supabase } = require('./database');

// ── 超時判定（純時間計算，不需要 DB） ───────────────────────────
function isOverdue(bookingDate, endTimeStr) {
  try {
    const endPart = endTimeStr.substring(0, 5); // "HH:MM"
    let [hours, minutes] = endPart.split(':').map(Number);
    hours += 1; // 1 小時緩衝

    let targetDateStr = bookingDate;
    if (hours >= 24) {
      hours -= 24;
      const nextDay = new Date(bookingDate);
      nextDay.setDate(nextDay.getDate() + 1);
      targetDateStr = nextDay.toISOString().split('T')[0];
    }

    const overdueTime = new Date(
      `${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
    );
    return new Date() > overdueTime;
  } catch (e) {
    return false;
  }
}

// ── 核心日期差距與點數計算 ─────────────────────────────────────
function calculateDaysDiff(bookingDateStr, actionDateStr) {
  const [by, bm, bd] = bookingDateStr.split('-').map(Number);
  const [ay, am, ad] = actionDateStr.split('-').map(Number);
  const bDate = new Date(by, bm - 1, bd);
  const aDate = new Date(ay, am - 1, ad);
  const diffTime = bDate.getTime() - aDate.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function getViolationPointsAndReason(daysDiff, type) {
  const actionName = type === 'cancel' ? '取消' : '變更';
  if (daysDiff >= 7) {
    return { points: 0, reason: `${daysDiff} 天前${actionName}預約` };
  } else if (daysDiff === 5 || daysDiff === 6) {
    return { points: 1, reason: `5-6 天前臨時${actionName}預約` };
  } else if (daysDiff === 3 || daysDiff === 4) {
    return { points: 2, reason: `3-4 天前臨時${actionName}預約` };
  } else if (daysDiff === 1 || daysDiff === 2) {
    return { points: 3, reason: `1-2 天前臨時${actionName}預約` };
  } else {
    // daysDiff <= 0
    return { points: 4, reason: `當日臨時${actionName}預約` };
  }
}

// ── 讀取所有違規覆蓋（維持舊介面相容） ──────────────────────────
async function getViolationMap() {
  const { data, error } = await supabase
    .from('violations')
    .select('booking_id, reason, is_cancelled, updated_at')
    .not('booking_id', 'is', null);

  if (error) {
    console.error('[violationsStore] getViolationMap error:', error.message);
    return {};
  }

  const map = {};
  for (const row of data) {
    map[row.booking_id] = {
      booking_id: row.booking_id,
      reason: row.reason,
      is_cancelled: row.is_cancelled,
      updated_at: row.updated_at,
    };
  }
  return map;
}

// ── 新增或更新違規記錄（手動/自動） ────────────────────────────────
async function saveViolation(bookingId, reason, isCancelled) {
  // 獲取預約詳細資訊以寫入緩存欄位
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*, rooms(name, branch)')
    .eq('id', Number(bookingId))
    .single();

  if (bErr || !booking) {
    console.error('[violationsStore] saveViolation cannot find booking:', bookingId);
    return;
  }

  let type = 'manual';
  let points = 0;
  if (reason === '租借未使用') {
    type = 'no_show';
    points = 4;
  } else if (reason === '未完整復歸場地') {
    type = 'late_return';
    points = 1;
  }

  const { data: existing } = await supabase
    .from('violations')
    .select('id')
    .eq('booking_id', Number(bookingId))
    .maybeSingle();

  const record = {
    booking_id: Number(bookingId),
    pastoral_zone: booking.pastoral_zone || '未知牧區',
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    room_name: booking.rooms?.name || '未知場地',
    branch: booking.rooms?.branch || '未知據點',
    full_name: booking.full_name,
    phone: booking.phone,
    user_email: booking.user_email,
    purpose: booking.purpose,
    violation_type: type,
    points: points,
    reason: reason || '未完整復歸場地',
    is_cancelled: !!isCancelled,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    const { error } = await supabase
      .from('violations')
      .update(record)
      .eq('id', existing.id);
    if (error) console.error('[violationsStore] saveViolation update error:', error.message);
  } else {
    record.created_at = new Date().toISOString();
    const { error } = await supabase
      .from('violations')
      .insert(record);
    if (error) console.error('[violationsStore] saveViolation insert error:', error.message);
  }
}

// ── 紀錄取消/變更違規點數 ──────────────────────────────────────
async function logCancellationViolation(booking, actionDateStr) {
  const daysDiff = calculateDaysDiff(booking.booking_date, actionDateStr);
  const { points, reason } = getViolationPointsAndReason(daysDiff, 'cancel');
  
  if (points === 0) return; // 無扣分則不記錄

  const record = {
    booking_id: booking.id,
    pastoral_zone: booking.pastoral_zone || '未知牧區',
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    room_name: booking.rooms?.name || booking.room_name || '未知場地',
    branch: booking.rooms?.branch || booking.branch || '未知據點',
    full_name: booking.full_name,
    phone: booking.phone,
    user_email: booking.user_email,
    purpose: booking.purpose,
    violation_type: 'cancel',
    points: points,
    reason: reason,
    is_cancelled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('violations').insert(record);
  if (error) {
    console.error('[violationsStore] logCancellationViolation error:', error.message);
  }
}

async function logChangeViolation(booking, actionDateStr) {
  const daysDiff = calculateDaysDiff(booking.booking_date, actionDateStr);
  const { points, reason } = getViolationPointsAndReason(daysDiff, 'change');

  if (points === 0) return; // 無扣分則不記錄

  // 變更可能有多次，先檢查是否已對此預約有變更違規紀錄（有則更新點數與原因，無則新增）
  const { data: existing } = await supabase
    .from('violations')
    .select('id')
    .eq('booking_id', booking.id)
    .eq('violation_type', 'change')
    .maybeSingle();

  const record = {
    booking_id: booking.id,
    pastoral_zone: booking.pastoral_zone || '未知牧區',
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    end_time: booking.end_time,
    room_name: booking.rooms?.name || booking.room_name || '未知場地',
    branch: booking.rooms?.branch || booking.branch || '未知據點',
    full_name: booking.full_name,
    phone: booking.phone,
    user_email: booking.user_email,
    purpose: booking.purpose,
    violation_type: 'change',
    points: points,
    reason: reason,
    is_cancelled: false,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    const { error } = await supabase
      .from('violations')
      .update(record)
      .eq('id', existing.id);
    if (error) console.error('[violationsStore] logChangeViolation update error:', error.message);
  } else {
    record.created_at = new Date().toISOString();
    const { error } = await supabase.from('violations').insert(record);
    if (error) console.error('[violationsStore] logChangeViolation insert error:', error.message);
  }
}

// ── 刪除違規記錄 ──────────────────────────────────────────────
async function deleteViolation(bookingId) {
  const { error } = await supabase
    .from('violations')
    .delete()
    .eq('booking_id', Number(bookingId));

  if (error) {
    console.error('[violationsStore] deleteViolation error:', error.message);
  }
}

// ── 判斷單筆預約的違規狀態（舊介面相容） ──────────────────────────
function getBookingViolation(b, violationMap) {
  const override = violationMap[b.id];

  if (override && override.is_cancelled) {
    return null;
  }

  if (override && !override.is_cancelled) {
    return { reason: override.reason || '未完整復歸場地' };
  }

  if (b.status === 'approved' && !b.is_returned && isOverdue(b.booking_date, b.end_time)) {
    return { reason: '未完整復歸場地' };
  }

  return null;
}

// ── 取得特定牧區單月所有違規 ────────────────────────────────────
async function getPastoralViolations(pastoralZone, year, month) {
  // 計算月份時間範圍 (Taipei 時間)
  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  let nextMonth = month;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear = year + 1;
  }
  const endOfMonth = new Date(nextYear, nextMonth, 1).toISOString();

  // 1. 查詢該牧區在該月份產生的所有「實體違規紀錄」
  const { data: dbViolations, error: vErr } = await supabase
    .from('violations')
    .select('*')
    .eq('pastoral_zone', pastoralZone)
    .gte('created_at', startOfMonth)
    .lt('created_at', endOfMonth);

  if (vErr) {
    console.error('[violationsStore] getPastoralViolations db error:', vErr.message);
    return { violations: [], totalPoints: 0, totalCount: 0 };
  }

  // 2. 查詢該牧區在該月份所有的「預約借用單」，用以判斷「動態超時違規」
  const startMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('*, rooms(name, branch)')
    .eq('pastoral_zone', pastoralZone)
    .gte('booking_date', startMonthStr)
    .lte('booking_date', endMonthStr);

  if (bErr) {
    console.error('[violationsStore] getPastoralViolations bookings error:', bErr.message);
    return { violations: dbViolations, totalPoints: 0, totalCount: 0 };
  }

  // 3. 獲取該牧區所有歷史違規 Map，以便過濾動態超時是否已處理
  const { data: allViolations } = await supabase
    .from('violations')
    .select('booking_id, is_cancelled, reason')
    .eq('pastoral_zone', pastoralZone);

  const vMap = {};
  if (allViolations) {
    for (const v of allViolations) {
      if (v.booking_id) {
        vMap[v.booking_id] = v;
      }
    }
  }

  const merged = [...dbViolations];

  // 4. 合併動態超時違規
  for (const b of bookings) {
    const overdue = b.status === 'approved' && !b.is_returned && isOverdue(b.booking_date, b.end_time);
    if (overdue) {
      const override = vMap[b.id];
      if (override) {
        // 如果有實體紀錄，則以實體紀錄為準（已在 dbViolations 中）
        continue;
      }
      // 無實體紀錄且超時 → 動態新增違規 (0 點，late_return)
      merged.push({
        booking_id: b.id,
        pastoral_zone: pastoralZone,
        booking_date: b.booking_date,
        start_time: b.start_time,
        end_time: b.end_time,
        room_name: b.rooms?.name || '未知場地',
        branch: b.rooms?.branch || '未知據點',
        full_name: b.full_name,
        phone: b.phone,
        user_email: b.user_email,
        purpose: b.purpose,
        violation_type: 'late_return',
        points: 1,
        reason: '未完整復歸場地',
        is_cancelled: false,
        created_at: `${b.booking_date}T${b.end_time}:00Z`, // 概估時間
        updated_at: `${b.booking_date}T${b.end_time}:00Z`
      });
    }
  }

  // 5. 計算總點數與未取消違規次數
  let totalPoints = 0;
  let totalCount = 0;
  const activeViolations = merged.filter(v => !v.is_cancelled);

  for (const v of activeViolations) {
    totalPoints += v.points;
    if (v.violation_type !== 'late_return' && v.reason !== '未完整復歸場地') {
      totalCount += 1;
    }
  }

  return {
    violations: merged,
    totalPoints,
    totalCount
  };
}

// ── 判斷牧區在特定日期是否被停權 ──────────────────────────────────
async function isPastoralZoneSuspended(pastoralZone, targetDateStr) {
  if (!pastoralZone) return false;

  // 取得目標日期的年、月
  const [ty, tm] = targetDateStr.split('-').map(Number);

  // 停權判定是在「前一個月」的累計違規
  let prevMonth = tm - 1;
  let prevYear = ty;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = ty - 1;
  }

  const { totalPoints, totalCount } = await getPastoralViolations(pastoralZone, prevYear, prevMonth);

  // 單月累計扣滿 5 點 或 違規達 2 次
  return totalPoints >= 5 || totalCount >= 2;
}

module.exports = {
  isOverdue,
  getViolationMap,
  saveViolation,
  deleteViolation,
  getBookingViolation,
  logCancellationViolation,
  logChangeViolation,
  getPastoralViolations,
  isPastoralZoneSuspended,
};


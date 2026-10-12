const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware, requireRole } = require('../authMiddleware');
const { deleteLockPasscode } = require('../tuyaClient');
const { getViolationMap, saveViolation, deleteViolation, getBookingViolation, isOverdue } = require('../violationsStore');

// 💡 密碼過期清理機制：自動回收已結束場地之密碼，節省資料庫儲存空間並落實安全限制
const cleanExpiredPasscodes = async () => {
  try {
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    const timeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // 1. 清理今天以前已結束的預約密碼
    await supabase
      .from('bookings')
      .update({ access_code: null })
      .not('access_code', 'is', null)
      .lt('booking_date', todayStr);

    // 2. 清理今天已結束的預約密碼
    await supabase
      .from('bookings')
      .update({ access_code: null })
      .not('access_code', 'is', null)
      .eq('booking_date', todayStr)
      .lt('end_time', timeStr);
  } catch (e) {
    console.error('[cleanExpiredPasscodes error]', e);
  }
};

// Helper to check if a booking overlaps with any approved bookings
async function checkOverlap(roomId, date, startTime, endTime, excludeId = null) {
  // 1. Fetch room name to see if it's "💒 由教會分配"
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('name')
    .eq('id', roomId)
    .single();

  if (roomErr || !room || room.name === '💒 由教會分配') {
    return null; // No conflict check for virtual room
  }

  // 2. Query other APPROVED bookings for the same room and date that overlap
  let query = supabase
    .from('bookings')
    .select('id, full_name, start_time, end_time')
    .eq('room_id', roomId)
    .eq('booking_date', date)
    .eq('status', 'approved')
    .lt('start_time', endTime)
    .gt('end_time', startTime);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Overlap check error:', error);
    throw new Error('檢查衝突時發生錯誤');
  }

  return data && data.length > 0 ? data : null;
}

// 管理端獲取所有預約 (依據點過濾)
router.get('/bookings', authMiddleware, requireRole(['admin', 'system_admin', 'inspector']), async (req, res) => {
  await cleanExpiredPasscodes();
  const { branch } = req.query;

  let targetBranch = branch;
  if (req.user.role !== 'system_admin' && req.user.branch !== '全') {
    targetBranch = req.user.branch;
  }

  if (!targetBranch) {
    return res.json([]);
  }

  let query = supabase
    .from('bookings')
    .select('*, rooms!inner(name, branch, tuya_device_id)')
    .eq('rooms.branch', targetBranch)
    .order('booking_date', { ascending: false });

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const violationMap = await getViolationMap();

  res.json(data.map(b => ({
    ...b,
    violation: getBookingViolation(b, violationMap)
  })));
});

// 管理端更新預約狀態 (核可/拒絕)
router.put('/bookings/:id/status', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  // 拒絕時必須填寫原因
  if (status === 'rejected' && (!rejection_reason || !rejection_reason.trim())) {
    return res.status(400).json({ error: '拒絕預約時必須填寫拒絕原因' });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, rooms(name, branch, tuya_device_id)')
    .eq('id', id)
    .single();

  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && (!booking || booking.rooms.branch !== req.user.branch)) {
    return res.status(403).json({ error: '無權限處理此據點的預約' });
  }

  if (status === 'approved') {
    try {
      const conflicts = await checkOverlap(booking.room_id, booking.booking_date, booking.start_time, booking.end_time, id);
      if (conflicts) {
        const names = conflicts.map(c => c.full_name).join('、');
        return res.status(409).json({ error: `時段衝突！該時段已被其他已核可的預約（借用人：${names}）佔用。` });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (status === 'rejected') {
    if (booking?.tuya_password_id && booking.rooms?.tuya_device_id) {
      try {
        await deleteLockPasscode(booking.rooms.tuya_device_id, booking.tuya_password_id);
      } catch (err) {
        console.error('[Tuya Delete Error on Reject]', err);
      }
    }
    // If status changes to rejected and was previously approved, log the cancellation violation!
    if (booking && booking.status === 'approved') {
      const { logCancellationViolation } = require('../violationsStore');
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
      await logCancellationViolation(booking, todayStr);
    }
  }

  // 管理端「退回待審核」：把已核可的預約放回待審核池以便重新安排場地。
  // 不做衝突檢查、不記任何違規紀錄；若原本已發門鎖密碼則一併回收。
  if (status === 'pending') {
    if (booking?.tuya_password_id && booking.rooms?.tuya_device_id) {
      try {
        await deleteLockPasscode(booking.rooms.tuya_device_id, booking.tuya_password_id);
      } catch (err) {
        console.error('[Tuya Delete Error on Revert-to-Pending]', err);
      }
    }
  }

  const updateFields = { status };
  if (status === 'rejected') {
    updateFields.access_code = null;
    updateFields.tuya_password_id = null;
    // 儲存拒絕原因（若資料庫欄位存在）
    if (rejection_reason) {
      updateFields.rejection_reason = rejection_reason.trim();
    }
  } else if (status === 'approved') {
    // 核可時清除舊有拒絕原因
    updateFields.rejection_reason = null;
  } else if (status === 'pending') {
    updateFields.access_code = null;
    updateFields.tuya_password_id = null;
    updateFields.rejection_reason = null;
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updateFields)
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// 管理端變更/分配場地
router.put('/bookings/:id/room', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { room_id } = req.body;
  
  if (!room_id) return res.status(400).json({ error: 'Missing room_id' });

  const { data: booking } = await supabase
    .from('bookings')
    .select('status, booking_date, start_time, end_time, room_id, tuya_password_id, rooms(branch, tuya_device_id)')
    .eq('id', id)
    .single();
  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && (!booking || booking.rooms.branch !== req.user.branch)) {
    return res.status(403).json({ error: '無權限處理此據點的預約' });
  }

  const isRoomChanged = Number(room_id) !== Number(booking.room_id);
  const updateFields = { room_id };

  if (booking.status === 'approved') {
    try {
      const conflicts = await checkOverlap(room_id, booking.booking_date, booking.start_time, booking.end_time, id);
      if (conflicts) {
        const names = conflicts.map(c => c.full_name).join('、');
        return res.status(409).json({ error: `時段衝突！該場地的時段已被其他已核可的預約（借用人：${names}）佔用。` });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    if (isRoomChanged) {
      if (booking.tuya_password_id && booking.rooms?.tuya_device_id) {
        try {
          await deleteLockPasscode(booking.rooms.tuya_device_id, booking.tuya_password_id);
        } catch (err) {
          console.error('[Tuya Delete Old Passcode Error on Room Change API]', err);
        }
      }
      updateFields.access_code = null;
      updateFields.tuya_password_id = null;
    }
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updateFields)
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// 管理端修改預約詳細資料
router.put('/bookings/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { booking_date, start_time, end_time, pastoral_zone, purpose, attendance_count, room_id } = req.body;

  const { data: booking } = await supabase.from('bookings').select('*, rooms(name, branch, tuya_device_id)').eq('id', id).single();
  if (!booking) return res.status(404).json({ error: '找不到該預約' });

  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && (!booking.rooms || booking.rooms.branch !== req.user.branch)) {
    return res.status(403).json({ error: '無權限修改此據點的預約' });
  }

  const targetRoomId = room_id !== undefined ? room_id : booking.room_id;
  const targetDate = booking_date !== undefined ? booking_date : booking.booking_date;
  const targetStart = start_time !== undefined ? start_time : booking.start_time;
  const targetEnd = end_time !== undefined ? end_time : booking.end_time;

  if (booking.status === 'approved') {
    try {
      const conflicts = await checkOverlap(targetRoomId, targetDate, targetStart, targetEnd, id);
      if (conflicts) {
        const names = conflicts.map(c => c.full_name).join('、');
        return res.status(409).json({ error: `時段衝突！該變更後的時段與其他已核可的預約（借用人：${names}）衝突。` });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const updateFields = {};
  if (booking_date !== undefined) updateFields.booking_date = booking_date;
  if (start_time !== undefined) updateFields.start_time = start_time;
  if (end_time !== undefined) updateFields.end_time = end_time;
  if (pastoral_zone !== undefined) updateFields.pastoral_zone = pastoral_zone;
  if (purpose !== undefined) updateFields.purpose = purpose;
  if (attendance_count !== undefined) {
    const countVal = Number(attendance_count);
    if (isNaN(countVal) || countVal <= 0) {
      return res.status(400).json({ error: '預計人數必須大於 0' });
    }
    updateFields.attendance_count = countVal;
  }
  if (room_id !== undefined) updateFields.room_id = room_id;

  const isTimeOrRoomChanged = 
    (booking_date !== undefined && booking_date !== booking.booking_date) ||
    (start_time !== undefined && start_time !== booking.start_time) ||
    (end_time !== undefined && end_time !== booking.end_time) ||
    (room_id !== undefined && Number(room_id) !== Number(booking.room_id));

  if (booking.status === 'approved' && isTimeOrRoomChanged) {
    const { logChangeViolation } = require('../violationsStore');
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    await logChangeViolation(booking, todayStr);

    if (booking.tuya_password_id && booking.rooms?.tuya_device_id) {
      try {
        await deleteLockPasscode(booking.rooms.tuya_device_id, booking.tuya_password_id);
      } catch (err) {
        console.error('[Tuya Delete Old Passcode Error on Detail Change API]', err);
      }
    }
    updateFields.access_code = null;
    updateFields.tuya_password_id = null;
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updateFields)
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// 違規紀錄名單 (獲取所有違規)
router.get('/violations', authMiddleware, requireRole(['admin', 'system_admin', 'inspector']), async (req, res) => {
  const { branch } = req.query;
  let targetBranch = branch;
  if (req.user.role !== 'system_admin' && req.user.branch !== '全') {
    targetBranch = req.user.branch;
  }
  if (!targetBranch) {
    return res.json([]);
  }

  // 1. 查詢所有實體違規紀錄
  let query = supabase.from('violations').select('*').order('created_at', { ascending: false });
  if (targetBranch !== '全') {
    query = query.eq('branch', targetBranch);
  }
  const { data: dbViolations, error: vErr } = await query;
  if (vErr) return res.status(500).json({ error: vErr.message });

  // 2. 查詢未歸還的已核可預約單以判定動態超時
  let bQuery = supabase
    .from('bookings')
    .select('*, rooms!inner(name, branch)')
    .eq('status', 'approved')
    .eq('is_returned', false);
  if (targetBranch !== '全') {
    bQuery = bQuery.eq('rooms.branch', targetBranch);
  }
  const { data: bookings, error: bErr } = await bQuery;
  if (bErr) return res.status(500).json({ error: bErr.message });

  const { isOverdue } = require('../violationsStore');
  const merged = [...dbViolations];
  const existingBookingIds = new Set(dbViolations.map(v => v.booking_id).filter(Boolean));

  for (const b of bookings) {
    if (isOverdue(b.booking_date, b.end_time)) {
      if (!existingBookingIds.has(b.id)) {
        merged.push({
          booking_id: b.id,
          user_email: b.user_email,
          full_name: b.full_name,
          phone: b.phone,
          booking_date: b.booking_date,
          start_time: b.start_time,
          end_time: b.end_time,
          room_name: b.rooms?.name || '未知場地',
          purpose: b.purpose,
          reason: '未完整復歸場地',
          is_manual: false,
          is_cancelled: false,
          points: 1,
          violation_type: 'late_return',
          created_at: `${b.booking_date}T${b.end_time}:00Z`,
          pastoral_zone: b.pastoral_zone || '未知牧區'
        });
      }
    }
  }

  const result = merged.map(v => ({
    id: v.id,
    booking_id: v.booking_id,
    user_email: v.user_email,
    full_name: v.full_name,
    phone: v.phone,
    booking_date: v.booking_date,
    start_time: v.start_time,
    end_time: v.end_time,
    room_name: v.room_name || v.rooms?.name || '未知場地',
    purpose: v.purpose,
    reason: v.reason,
    points: v.points || 0,
    violation_type: v.violation_type || 'manual',
    is_cancelled: v.is_cancelled || false,
    pastoral_zone: v.pastoral_zone || '未知牧區',
    is_manual: v.violation_type === 'manual' || v.violation_type === 'no_show',
    created_at: v.created_at
  }));

  res.json(result);
});

// 新增違規
router.post('/violations', authMiddleware, requireRole(['admin', 'system_admin', 'inspector']), async (req, res) => {
  const { booking_id, reason } = req.body;
  if (!booking_id || !reason) {
    return res.status(400).json({ error: 'Missing booking_id or reason' });
  }

  await saveViolation(booking_id, reason, false);
  res.json({ success: true });
});

// 編輯違規原因
router.put('/violations/:booking_id', authMiddleware, requireRole(['admin', 'system_admin', 'inspector']), async (req, res) => {
  const { booking_id } = req.params;
  const { reason } = req.body;
  if (!reason) {
    return res.status(400).json({ error: 'Missing reason' });
  }

  const violationMap = await getViolationMap();
  const existing = violationMap[booking_id];
  const isCancelled = existing ? existing.is_cancelled : false;

  await saveViolation(booking_id, reason, isCancelled);
  res.json({ success: true });
});

// 取消/刪除違規
router.delete('/violations/:id_or_booking_id', authMiddleware, requireRole(['admin', 'system_admin', 'inspector']), async (req, res) => {
  const param = req.params.id_or_booking_id;

  // 先尋找實體違規記錄
  let vQuery = supabase.from('violations').select('*');
  if (isNaN(Number(param))) {
    vQuery = vQuery.eq('booking_id', param);
  } else {
    vQuery = vQuery.or(`id.eq.${param},booking_id.eq.${param}`);
  }
  const { data: vRecord } = await vQuery.maybeSingle();

  if (!vRecord) {
    // 如果沒有實體紀錄，可能要赦免動態超時預約
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_date, end_time, status, is_returned')
      .eq('id', Number(param))
      .single();

    const overdue = booking && booking.status === 'approved' && !booking.is_returned && isOverdue(booking.booking_date, booking.end_time);
    if (overdue) {
      await saveViolation(Number(param), '未完整復歸場地', true);
    }
    return res.json({ success: true });
  }

  if (vRecord.violation_type === 'late_return') {
    if (vRecord.is_cancelled) {
      // 已經是已撤銷狀態，徹底從資料庫中刪除
      const { error } = await supabase.from('violations').delete().eq('id', vRecord.id);
      if (error) console.error('[admin router delete cancelled violation error]', error.message);
      
      // 同步將預約單更新為已歸還，防止再次產生動態超時
      const { error: bErr } = await supabase.from('bookings').update({ is_returned: true }).eq('id', vRecord.booking_id);
      if (bErr) console.error('[admin router update booking error]', bErr.message);
    } else {
      await saveViolation(vRecord.booking_id, '未完整復歸場地', true);
    }
  } else {
    const { error } = await supabase.from('violations').delete().eq('id', vRecord.id);
    if (error) console.error('[admin router delete violation error]', error.message);
  }

  res.json({ success: true });
});

// ── 表單自動匯入紀錄（人工審核用） ────────────────────────────
// 每一列 = 一次 Google 表單提交（含解析成功/失敗的完整原始內容）。
router.get('/form-intake', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { status } = req.query; // 'unresolved' (預設) | 'all'
  let query = supabase
    .from('form_intake_log')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(300);
  if (status !== 'all') query = query.eq('resolved', false);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.put('/form-intake/:id/resolve', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { resolved } = req.body;
  const nextResolved = resolved !== false;

  const { data, error } = await supabase
    .from('form_intake_log')
    .update({
      resolved: nextResolved,
      resolved_at: nextResolved ? new Date().toISOString() : null,
      resolved_by: nextResolved ? (req.user?.email || null) : null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;

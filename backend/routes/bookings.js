const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { sendBookingConfirmation, sendRoomPassword } = require('../mailService');
const { authMiddleware, optionalAuthMiddleware, requireRole } = require('../authMiddleware');
const { syncLockPasscode, deleteLockPasscode } = require('../tuyaClient');
const {
  ALLOWED_BOOKING_TYPES,
  sanitizeString,
  isAllowed,
} = require('../validators');

const BlockPipeline = require('../blocks/BlockPipeline');
const BookingError = require('../blocks/BookingError');
const InputValidationBlock = require('../blocks/InputValidationBlock');
const TimingPolicyBlock = require('../blocks/TimingPolicyBlock');
const SuspensionCheckBlock = require('../blocks/SuspensionCheckBlock');
const OverlapCheckBlock = require('../blocks/OverlapCheckBlock');
const DbInsertBlock = require('../blocks/DbInsertBlock');
const EmailNotifyBlock = require('../blocks/EmailNotifyBlock');

/** 使用者自行取消時寫入 rejection_reason，前台據此顯示「已取消」而非「未通過」 */
const SELF_CANCEL_REASON = '使用者自行取消';

/** 借用日距今天不足 7 天（一般使用者此時不能線上取消或修改） */
const isWithinSevenDays = (bookingDateStr) => {
  const [yr, mo, dy] = bookingDateStr.split('-').map(Number);
  const bookingTime = new Date(yr, mo - 1, dy).getTime();
  const today = new Date();
  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return (bookingTime - todayTime) < 7 * 24 * 60 * 60 * 1000;
};

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

// 取得特定牧區在指定月份的扣點與停權狀態
router.get('/pastor-status', async (req, res) => {
  const { pastoralZone, date } = req.query;
  if (!pastoralZone || !date) {
    return res.status(400).json({ error: 'Missing pastoralZone or date parameter' });
  }

  const { getPastoralViolations, isPastoralZoneSuspended } = require('../violationsStore');
  const [yr, mo] = date.split('-').map(Number);

  try {
    const summary = await getPastoralViolations(pastoralZone, yr, mo);
    const suspended = await isPastoralZoneSuspended(pastoralZone, date);
    
    res.json({
      pastoralZone,
      year: yr,
      month: mo,
      totalPoints: summary.totalPoints,
      totalCount: summary.totalCount,
      violations: summary.violations,
      suspended
    });
  } catch (err) {
    console.error('[pastor-status route error]', err);
    res.status(500).json({ error: 'Failed to retrieve pastor status' });
  }
});

// 取得停權/取消資格的牧區名單 (本月與次月)
router.get('/disqualified-zones', authMiddleware, async (req, res) => {
  try {
    const { getPastoralViolations } = require('../violationsStore');
    
    // 計算目前與下個月份 (以台北時間計)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = currentYear + 1;
    }
    
    const monthsToCheck = [
      { year: currentYear, month: currentMonth, dateStr: `${currentYear}-${String(currentMonth).padStart(2, '0')}` },
      { year: nextYear, month: nextMonth, dateStr: `${nextYear}-${String(nextMonth).padStart(2, '0')}` }
    ];

    const userRole = req.user.role;
    const userBranch = req.user.branch;
    const { branch: reqBranch } = req.query;

    const isGlobalAdmin = ['system_admin', 'inspector'].includes(userRole);
    const isBranchAdmin = userRole === 'admin' && (userBranch === '全' || (reqBranch && userBranch === reqBranch));
    const isEffectiveAdmin = isGlobalAdmin || isBranchAdmin;

    let zonesToCheck = [];
    if (isEffectiveAdmin) {
      // 管理員：撈取所有在預約或違規中出現過的牧區
      const { data: bZones } = await supabase.from('bookings').select('pastoral_zone');
      const { data: vZones } = await supabase.from('violations').select('pastoral_zone');
      
      const zoneSet = new Set();
      if (bZones) bZones.forEach(b => b.pastoral_zone && zoneSet.add(b.pastoral_zone.trim()));
      if (vZones) vZones.forEach(v => v.pastoral_zone && zoneSet.add(v.pastoral_zone.trim()));
      
      zoneSet.delete('');
      zoneSet.delete('無牧區');
      zoneSet.delete('未知牧區');
      zoneSet.delete('其他');
      zonesToCheck = Array.from(zoneSet);
    } else {
      // 一般使用者：僅撈取自己所屬牧區
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('pastoral_zone')
        .eq('id', req.user.id)
        .single();
      
      const pZone = profile?.pastoral_zone;
      if (pZone && pZone !== '無牧區' && pZone !== '未知牧區' && pZone !== '其他') {
        zonesToCheck = [pZone.trim()];
      }
    }

    const disqualified = [];
    
    for (const monthObj of monthsToCheck) {
      const { year, month, dateStr } = monthObj;
      let prevMonth = month - 1;
      let prevYear = year;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = year - 1;
      }
      
      for (const zone of zonesToCheck) {
        const { totalPoints, totalCount } = await getPastoralViolations(zone, prevYear, prevMonth);
        const isSuspended = totalPoints >= 5 || totalCount >= 2;
        if (isSuspended) {
          disqualified.push({
            pastoralZone: zone,
            suspendedMonth: dateStr,
            reasonMonth: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
            totalPoints,
            totalCount
          });
        }
      }
    }

    res.json(disqualified);
  } catch (err) {
    console.error('[disqualified-zones error]', err);
    res.status(500).json({ error: 'Failed to fetch disqualified zones' });
  }
});

// 每週借用狀況看板 (公開讀取)
router.get('/weekly', optionalAuthMiddleware, async (req, res) => {
  await cleanExpiredPasscodes();
  const { start, end, branch } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'Missing start or end date' });

  let query = supabase
    .from('bookings')
    .select('id, room_id, rooms!inner(name, branch), full_name, pastoral_zone, purpose, booking_date, start_time, end_time, booking_type, is_returned, phone, attendance_count, status')
    .gte('booking_date', start)
    .lte('booking_date', end);

  if (branch) query = query.eq('rooms.branch', branch);
  
  query = query.in('status', ['approved', 'pending']);
  
  const { data, error } = await query
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) return res.status(500).json({ error: 'Failed to fetch weekly bookings' });

  const maskedData = data.map(b => ({
    ...b,
    user_email: b.user_email ? `${b.user_email.split('@')[0].slice(0, 3)}***@${b.user_email.split('@')[1]}` : '系統預約',
    full_name: b.full_name ? `${b.full_name[0]}**` : '匿名'
  }));

  res.json(maskedData);
});

// 取得婚禮與重要活動清單
router.get('/special', optionalAuthMiddleware, async (req, res) => {
  await cleanExpiredPasscodes();
  const { branch } = req.query;

  let query = supabase
    .from('bookings')
    .select('id, room_id, rooms!inner(name, branch), full_name, pastoral_zone, purpose, booking_date, start_time, end_time, booking_type, is_returned, phone, attendance_count, status')
    .in('booking_type', ['婚禮', '重要']);

  if (branch) query = query.eq('rooms.branch', branch);

  query = query.in('status', ['approved', 'pending']);

  const { data, error } = await query
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Fetch special bookings error:', error);
    return res.status(500).json({ error: 'Failed to fetch special bookings' });
  }

  res.json(data);
});

// 檢查特定時段所有場地的可用性

router.get('/check-all', async (req, res) => {
  const { date, start, end } = req.query;
  if (!date || !start || !end) return res.status(400).json({ error: 'Missing params' });

  const { data, error } = await supabase
    .from('bookings')
    .select('room_id')
    .eq('booking_date', date)
    .lt('start_time', end)
    .gt('end_time', start)
    .neq('status', 'rejected');

  if (error) return res.status(500).json({ error: 'Check failed' });

  const directBookedRoomIds = [...new Set(data.map(b => b.room_id))];

  // 獲取所有場地的父子空間關係，以擴展衝突判定
  const { data: allRooms, error: roomsErr } = await supabase
    .from('rooms')
    .select('id, parent_room_id');

  if (roomsErr || !allRooms) {
    return res.json(directBookedRoomIds);
  }

  const bookedRoomIds = new Set(directBookedRoomIds);

  directBookedRoomIds.forEach(rId => {
    const room = allRooms.find(r => r.id === rId);
    if (room) {
      if (room.parent_room_id) {
        bookedRoomIds.add(room.parent_room_id);
      }
      allRooms.forEach(r => {
        if (r.parent_room_id === rId) {
          bookedRoomIds.add(r.id);
        }
      });
    }
  });

  res.json(Array.from(bookedRoomIds));
});

// 取得目前正在使用中的場地
router.get('/now', async (req, res) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  const timeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit' });

  const { branch } = req.query;

  let query = supabase
    .from('bookings')
    .select('room_id, rooms!inner(name, branch)')
    .eq('booking_date', dateStr)
    .neq('status', 'rejected')
    .lte('start_time', timeStr)
    .gt('end_time', timeStr);

  if (branch) {
    query = query.eq('rooms.branch', branch);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: 'Failed to fetch active bookings' });
  res.json(data);
});

// 取得特定日期所有已核准的場地預約
router.get('/by-date', async (req, res) => {
  const { date, branch } = req.query;
  if (!date) return res.status(400).json({ error: 'Missing date parameter' });

  let query = supabase
    .from('bookings')
    .select('id, room_id, start_time, end_time, purpose, pastoral_zone, status, rooms!inner(name, branch)')
    .eq('booking_date', date)
    .neq('status', 'rejected');

  if (branch) {
    query = query.eq('rooms.branch', branch);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch bookings by date' });
  
  res.json(data);
});

// 獲取借用記錄
router.get('/', authMiddleware, async (req, res) => {
  await cleanExpiredPasscodes();
  const { branch } = req.query;
  
  if (!branch) {
    return res.json([]);
  }
  
  let query = supabase.from('bookings').select(`id, room_id, user_email, full_name, phone, pastoral_zone, purpose, booking_type, attendance_count, booking_date, start_time, end_time, is_returned, access_code, tuya_password_id, created_at, status, rejection_reason, cleaning_assignments, rooms!inner(name, branch, tuya_device_id)`)
    .order('booking_date', { ascending: false }).order('start_time', { ascending: false });

  // ALWAYS filter by logged-in user's email, so even admins only see their own records on the frontend
  query = query.eq('user_email', req.user.email);

  query = query.eq('rooms.branch', branch);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch bookings' });

  const { getViolationMap, getBookingViolation } = require('../violationsStore');
  const violationMap = getViolationMap();

  res.json(data.map((b) => ({
    ...b,
    access_code: b.status === 'approved' ? b.access_code : null,
    tuya_password_id: b.status === 'approved' ? b.tuya_password_id : null,
    room_name: b.rooms?.name || '',
    tuya_device_id: b.rooms?.tuya_device_id || null,
    rooms: undefined,
    violation: getBookingViolation(b, violationMap)
  })));
});

// 創建預約
router.post('/', authMiddleware, async (req, res) => {
  const context = {
    reqBody: req.body,
    user: req.user
  };

  const pipeline = new BlockPipeline();
  pipeline
    .use(new InputValidationBlock())
    .use(new TimingPolicyBlock())
    .use(new SuspensionCheckBlock())
    .use(new OverlapCheckBlock())
    .use(new DbInsertBlock())
    .use(new EmailNotifyBlock());

  try {
    await pipeline.run(context);
    res.status(context.responseStatus || 200).json(context.responseData);
  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[Create Booking Error]', error);
    res.status(500).json({ error: '建立預約失敗，請稍後再試' });
  }
});

// 使用者編輯自己的預約（日期、時段、場地、人數、用途）
// 已核准的預約若改了時間或場地，會退回待審核、清除門鎖密碼，並依天數記「變更」違規
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { date, startTime, endTime, roomId, purpose, attendanceCount } = req.body;

  try {
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*, rooms(name, branch, tuya_device_id)')
      .eq('id', id)
      .eq('user_email', req.user.email)
      .single();

    if (fetchError || !booking) {
      return res.status(404).json({ error: '找不到該預約，或您無權操作此預約' });
    }
    if (booking.status === 'rejected') {
      return res.status(400).json({ error: '已取消或未通過的預約無法編輯' });
    }
    if (booking.is_returned) {
      return res.status(400).json({ error: '已歸還的預約無法編輯' });
    }
    if (!ALLOWED_BOOKING_TYPES.includes(booking.booking_type || '一般借用')) {
      return res.status(400).json({ error: '此筆申請無法線上編輯，請聯絡管理單位' });
    }
    if (req.user.role === 'user' && isWithinSevenDays(booking.booking_date)) {
      return res.status(400).json({ error: '❌ 借用日期一週內之取消或異動，請直接向管理單位或值班人員聯絡，無法線上自行修改。' });
    }

    const newSlot = {
      date: date || booking.booking_date,
      startTime: (startTime || booking.start_time).substring(0, 5),
      endTime: (endTime || booking.end_time).substring(0, 5),
    };
    const context = {
      reqBody: {
        roomId: roomId || booking.room_id,
        purpose: purpose !== undefined ? purpose : booking.purpose,
        attendanceCount: attendanceCount !== undefined ? attendanceCount : booking.attendance_count,
        fullName: booking.full_name,
        phone: booking.phone,
        pastoralZone: booking.pastoral_zone,
        bookingType: booking.booking_type || '一般借用',
        slots: [newSlot],
      },
      user: req.user,
      excludeBookingId: booking.id,
    };

    const pipeline = new BlockPipeline();
    pipeline
      .use(new InputValidationBlock())
      .use(new TimingPolicyBlock());
    // 停權只限制「新增」該月份的借用；同月份內調整既有預約不受影響
    if (newSlot.date.substring(0, 7) !== booking.booking_date.substring(0, 7)) {
      pipeline.use(new SuspensionCheckBlock());
    }
    pipeline.use(new OverlapCheckBlock());
    await pipeline.run(context);

    const targetRoom = context.targetRooms[0];
    if (booking.rooms && targetRoom.branch !== booking.rooms.branch) {
      return res.status(400).json({ error: '只能更換為同一據點的場地' });
    }

    const next = context.bookingsToInsert[0];
    if (!next) {
      return res.status(409).json({ error: '修改後的內容與您另一筆預約完全相同' });
    }

    const isTimeOrRoomChanged =
      next.booking_date !== booking.booking_date ||
      next.start_time !== booking.start_time.substring(0, 5) ||
      next.end_time !== booking.end_time.substring(0, 5) ||
      Number(next.room_id) !== Number(booking.room_id);

    const updateFields = {
      booking_date: next.booking_date,
      start_time: next.start_time,
      end_time: next.end_time,
      room_id: next.room_id,
      purpose: next.purpose,
      attendance_count: next.attendance_count,
    };

    const needsReview = booking.status === 'approved' && isTimeOrRoomChanged;
    if (needsReview) {
      const { logChangeViolation } = require('../violationsStore');
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
      await logChangeViolation(booking, todayStr);

      if (booking.tuya_password_id && booking.rooms?.tuya_device_id) {
        try {
          await deleteLockPasscode(booking.rooms.tuya_device_id, booking.tuya_password_id);
        } catch (err) {
          console.error('[Tuya Delete Error on User Edit]', err);
        }
      }
      updateFields.status = 'pending';
      updateFields.access_code = null;
      updateFields.tuya_password_id = null;
    }

    const { data, error: updateError } = await supabase
      .from('bookings')
      .update(updateFields)
      .eq('id', id)
      .select();

    if (updateError || !data || data.length === 0) {
      return res.status(500).json({ error: '修改預約失敗，請稍後再試' });
    }

    res.json({
      booking: data[0],
      message: needsReview ? '預約已修改，將重新送交審核' : '預約已修改',
    });
  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[Update Booking Error]', error);
    res.status(500).json({ error: '修改預約失敗，請稍後再試' });
  }
});

// 取消預約
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userEmail = req.user.email;
  const userRole = req.user.role;

  try {
    let query = supabase.from('bookings').select('*, rooms(name, branch, tuya_device_id)');
    if (userRole === 'user') {
      query = query.eq('user_email', userEmail);
    }
    const { data: booking, error: fetchError } = await query.eq('id', id).single();

    if (fetchError || !booking) {
      return res.status(404).json({ error: '找不到該預約，或您無權操作此預約' });
    }

    if (booking.status === 'rejected') {
      return res.status(400).json({ error: '該預約已經是取消或拒絕狀態' });
    }

    if (userRole === 'user' && isWithinSevenDays(booking.booking_date)) {
      return res.status(400).json({ error: '❌ 借用日期一週內之取消或異動，請直接向管理單位或值班人員聯絡，無法線上自行取消。' });
    }

    if (booking.tuya_password_id && booking.rooms?.tuya_device_id) {
      try {
        await deleteLockPasscode(booking.rooms.tuya_device_id, booking.tuya_password_id);
      } catch (err) {
        console.error('[Tuya Delete Error on Cancel]', err);
      }
    }

    if (booking.status === 'approved') {
      const { logCancellationViolation } = require('../violationsStore');
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
      await logCancellationViolation(booking, todayStr);
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'rejected',
        access_code: null,
        tuya_password_id: null,
        rejection_reason: booking.user_email === userEmail ? SELF_CANCEL_REASON : '管理員取消'
      })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({ error: '取消預約失敗，請稍後再試' });
    }

    res.json({ message: '預約已成功取消' });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 使用者確認使用完畢並提交打掃收拾，等待管理員檢查
router.put('/:id/complete-usage', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userEmail = req.user.email;
  const userRole = req.user.role;

  try {
    let query = supabase.from('bookings').select('id, user_email, status, cleaning_assignments');
    if (userRole === 'user') {
      query = query.eq('user_email', userEmail);
    }
    const { data: booking, error: fetchError } = await query.eq('id', id).single();

    if (fetchError || !booking) {
      return res.status(404).json({ error: '找不到該預約，或您無權操作此預約' });
    }

    let cleanAssign = booking.cleaning_assignments || '';
    const parts = cleanAssign.split('::');
    const spaces = parts[0] || '';
    const state = parts[1] || '';
    const progress = parts[2] || '';

    let newState = 'submitted';
    if (state === 'rejected') {
      newState = 'resubmitted';
    }

    let newCleanAssign = spaces;
    newCleanAssign += `::${newState}`;
    if (progress) {
      newCleanAssign += `::${progress}`;
    }
    cleanAssign = newCleanAssign;

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ cleaning_assignments: cleanAssign })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({ error: '提交使用完畢確認失敗，請稍後再試' });
    }

    res.json({ message: '場地使用完畢收拾已確認！已通知同工進行現場檢查，檢查核可後即完成歸還。' });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 管理員指派公共空間打掃
router.put('/:id/cleaning', authMiddleware, requireRole(['admin', 'system_admin', 'inspector']), async (req, res) => {
  const { id } = req.params;
  const { cleaning_assignments } = req.body;

  try {
    const { error } = await supabase
      .from('bookings')
      .update({ cleaning_assignments })
      .eq('id', id);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: '指派公共區域打掃失敗，請確認該欄位已在資料庫中建立' });
    }

    res.json({ message: '公共空間打掃指派成功！' });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 刪除預約
router.delete('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;

  const { data: booking } = await supabase.from('bookings').select('*, rooms(name, branch, tuya_device_id)').eq('id', id).single();
  if (!booking) return res.status(404).json({ error: '找不到該預約' });

  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && booking.rooms?.branch !== req.user.branch) {
    return res.status(403).json({ error: '您無權刪除此據點的預約' });
  }

  if (booking.tuya_password_id && booking.rooms?.tuya_device_id) {
    try {
      await deleteLockPasscode(booking.rooms.tuya_device_id, booking.tuya_password_id);
    } catch (err) {
      console.error('[Tuya Delete Error on Delete]', err);
    }
  }

  // If booking is deleted and was previously approved, log the cancellation violation!
  if (booking && booking.status === 'approved') {
    const { logCancellationViolation } = require('../violationsStore');
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    await logCancellationViolation(booking, todayStr);
  }

  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'Failed to delete booking' });
  res.json({ message: '刪除成功' });
});

// 更新歸還狀態
router.put('/:id/return', authMiddleware, requireRole(['admin', 'system_admin', 'inspector']), async (req, res) => {
  const { id } = req.params;
  const { is_returned } = req.body;

  const { data: booking } = await supabase.from('bookings').select('cleaning_assignments, rooms(branch)').eq('id', id).single();
  if (!booking) return res.status(404).json({ error: '找不到該預約' });

  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && booking.rooms?.branch !== req.user.branch) {
    return res.status(403).json({ error: '您無權修改此據點的預約歸還狀態' });
  }

  let cleanAssign = booking.cleaning_assignments || '';
  if (Boolean(is_returned)) {
    const parts = cleanAssign.split('::');
    cleanAssign = parts[0] || '';
  }

  const { error } = await supabase.from('bookings').update({ 
    is_returned: Boolean(is_returned),
    cleaning_assignments: cleanAssign
  }).eq('id', id);

  if (error) return res.status(500).json({ error: 'Failed to update booking status' });
  res.json({ message: '更新成功' });
});

// 產生並發送隨機密碼 (或更新/重置密碼)
router.post('/:id/send-password', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { data: booking, error: fetchError } = await supabase.from('bookings').select('user_email, booking_date, start_time, end_time, status, tuya_password_id, rooms(name, branch, tuya_device_id)').eq('id', id).single();
  if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });
  
  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && booking.rooms?.branch !== req.user.branch) {
    return res.status(403).json({ error: '您無權發送此據點的場地密碼' });
  }

  if (booking.status !== 'approved') {
    return res.status(400).json({ error: '只能為已核可的預約產生並發送密碼' });
  }

  // 若已有舊密碼，先從智慧門鎖刪除
  if (booking.tuya_password_id && booking.rooms?.tuya_device_id) {
    try {
      await deleteLockPasscode(booking.rooms.tuya_device_id, booking.tuya_password_id);
    } catch (err) {
      console.error('[Tuya Delete Old Passcode Error on Regenerate]', err);
    }
  }

  const password = Math.floor(100000 + Math.random() * 900000).toString();
  
  let tuya_password_id = null;
  let tuya_sync_error = null;

  if (booking.rooms?.tuya_device_id) {
    const startBufferMinutes = 10;
    const endBufferMinutes = 15;
    
    // 確保 start_time 和 end_time 格式正確（支援 HH:mm 和 HH:mm:ss）
    let startTimeStr = booking.start_time || '';
    if (startTimeStr.split(':').length === 2) {
      startTimeStr = `${startTimeStr}:00`;
    }
    let endTimeStr = booking.end_time || '';
    if (endTimeStr.split(':').length === 2) {
      endTimeStr = `${endTimeStr}:00`;
    }

    const startDt = new Date(`${booking.booking_date}T${startTimeStr}+08:00`);
    let effectiveTime = Math.floor(startDt.getTime() / 1000) - (startBufferMinutes * 60);
    
    // 💡 最佳化：若計算出來的生效時間已經是過去（例如活動即將開始或已開始），則將生效時間設為「目前時間」，確保密碼能立即生效使用
    const nowUnix = Math.floor(Date.now() / 1000);
    if (effectiveTime < nowUnix) {
      effectiveTime = nowUnix;
    }
    
    let endDt;
    if (endTimeStr.substring(0, 5) === '00:00') {
      const nextDay = new Date(startDt);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
      endDt = new Date(`${nextDayStr}T00:00:00+08:00`);
    } else {
      endDt = new Date(`${booking.booking_date}T${endTimeStr}+08:00`);
    }
    const invalidTime = Math.floor(endDt.getTime() / 1000) + (endBufferMinutes * 60);

    try {
      tuya_password_id = await syncLockPasscode(booking.rooms.tuya_device_id, `Booking #${id}`, password, effectiveTime, invalidTime);
    } catch (err) {
      console.error('[Tuya Sync Error]', err);
      tuya_sync_error = err.message;
    }
  }

  const { error: updateError } = await supabase.from('bookings').update({ 
    access_code: password,
    tuya_password_id: tuya_password_id
  }).eq('id', id);
  
  if (updateError) return res.status(500).json({ error: 'Failed to save access code' });
  
  const roomName = booking.rooms?.name || '未知場地';
  await sendRoomPassword(booking.user_email, roomName, password);
  
  res.json({ 
    message: tuya_sync_error 
      ? `密碼已產生並寄出，但同步至智慧鎖失敗：${tuya_sync_error}` 
      : '密碼已成功產生、同步至智慧鎖並寄出', 
    access_code: password,
    tuya_synced: !!tuya_password_id,
    tuya_error: tuya_sync_error
  });
});

// 重發密碼郵件
router.post('/:id/resend-password-email', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { data: booking, error: fetchError } = await supabase.from('bookings').select('user_email, access_code, status, rooms(name, branch)').eq('id', id).single();
  if (fetchError || !booking) return res.status(404).json({ error: 'Booking not found' });
  
  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && booking.rooms?.branch !== req.user.branch) {
    return res.status(403).json({ error: '您無權重發此據點的場地密碼郵件' });
  }

  if (booking.status !== 'approved') {
    return res.status(400).json({ error: '只能為已核可的預約重發密碼' });
  }

  if (!booking.access_code) {
    return res.status(400).json({ error: '該預約尚未產生密碼，請先發送/產生密碼' });
  }

  const roomName = booking.rooms?.name || '未知場地';
  try {
    await sendRoomPassword(booking.user_email, roomName, booking.access_code);
    res.json({ message: '密碼郵件已成功重發' });
  } catch (err) {
    console.error('[Resend Email Error]', err);
    res.status(500).json({ error: '發送郵件失敗：' + err.message });
  }
});

module.exports = router;

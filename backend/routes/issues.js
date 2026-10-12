const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware, requireRole } = require('../authMiddleware');
const { sanitizeString, isAllowed, ALLOWED_ISSUE_STATUSES } = require('../validators');

// 檢視場地問題 (依據點過濾)
router.get('/', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { branch } = req.query;

  let targetBranch = branch;
  if (req.user.role !== 'system_admin' && req.user.branch !== '全') {
    targetBranch = req.user.branch;
  }

  if (!targetBranch) {
    return res.json([]);
  }

  let query = supabase
    .from('room_issues')
    .select('*, rooms!inner(name, branch), user_profiles(full_name)')
    .eq('rooms.branch', targetBranch)
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch issues' });
  res.json(data);
});

// 場地問題回報 (使用者發起)
router.post('/', authMiddleware, async (req, res) => {
  const { room_id, description } = req.body;

  if (!room_id || !description) return res.status(400).json({ error: '場地ID與問題描述為必填欄位' });

  const cleanDescription = sanitizeString(description, 1000);

  // 一般使用者僅能回報有核可借用，且在借用期間至借用結束後 8 小時內的場地問題 (管理員不受此限)
  if (req.user.role !== 'admin' && req.user.role !== 'system_admin') {
    const { data: userBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('booking_date, start_time, end_time, status')
      .eq('user_email', req.user.email)
      .eq('room_id', room_id)
      .eq('status', 'approved');

    if (bookingError) {
      return res.status(500).json({ error: '檢查借用紀錄時發生錯誤' });
    }

    const now = new Date();
    const hasValidBooking = userBookings && userBookings.some(b => {
      try {
        const startDt = new Date(`${b.booking_date}T${b.start_time.substring(0, 5)}:00+08:00`);
        let endDt;
        const endTimeStr = b.end_time.substring(0, 5);
        if (endTimeStr === '00:00') {
          const nextDay = new Date(startDt);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayStr = nextDay.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
          endDt = new Date(`${nextDayStr}T00:00:00+08:00`);
        } else {
          endDt = new Date(`${b.booking_date}T${endTimeStr}:00+08:00`);
        }
        
        const eightHoursLater = new Date(endDt.getTime() + 8 * 60 * 60 * 1000);
        return now >= startDt && now <= eightHoursLater;
      } catch (e) {
        return false;
      }
    });

    if (!hasValidBooking) {
      return res.status(403).json({ error: '回報失敗：回報問題僅開放於場地借用開始後，至使用完畢（借完）後 8 小時內進行。' });
    }
  }

  const { data, error } = await supabase.from('room_issues').insert({ room_id, description: cleanDescription, reported_by: req.user.id }).select().single();
  if (error) return res.status(500).json({ error: 'Failed to report issue' });
  res.json(data);
});

// 更新場地問題狀態
router.put('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { status } = req.body;

  if (!status || !isAllowed(status, ALLOWED_ISSUE_STATUSES)) {
    return res.status(400).json({ error: `無效的問題狀態，允許值：${ALLOWED_ISSUE_STATUSES.join(', ')}` });
  }

  const { data, error } = await supabase.from('room_issues').update({ status }).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: 'Failed to update issue' });
  res.json(data);
});

// 刪除場地問題
router.delete('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('room_issues').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'Failed to delete issue' });
  res.json({ success: true });
});

module.exports = router;

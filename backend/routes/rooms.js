const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware, requireRole } = require('../authMiddleware');
const { sanitizeString } = require('../validators');

// 獲取場地 (可選據點過濾)
router.get('/', async (req, res) => {
  const { branch } = req.query;
  let query = supabase.from('rooms').select('*').order('id', { ascending: true });
  if (branch) query = query.eq('branch', branch);
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch rooms' });
  res.json(data);
});

// 管理員新增場地
router.post('/', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { name, capacity, description, image_url, branch, tuya_device_id, tuya_light_id, tuya_ac_id } = req.body;

  if (!name || !branch) return res.status(400).json({ error: '場地名稱與據點為必填欄位' });

  if (req.user.role !== 'system_admin' && req.user.branch !== branch) {
    return res.status(403).json({ error: '您無權管理此據點的場地' });
  }

  const cleanName = sanitizeString(name, 100);
  const cleanDesc = sanitizeString(description, 500);

  // 檢查是否已存在同名場地
  const { data: existing } = await supabase
    .from('rooms')
    .select('id')
    .eq('name', cleanName)
    .eq('branch', branch)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ error: `此據點已存在名為「${cleanName}」的場地，名稱不能重複` });
  }

  const { data, error } = await supabase
    .from('rooms')
    .insert([{ name: cleanName, capacity: Number(capacity) || 0, description: cleanDesc, image_url, branch, tuya_device_id, tuya_light_id, tuya_ac_id }])
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // Sync to public_spaces if tuya_light_id is set
  if (tuya_light_id) {
    await supabase
      .from('public_spaces')
      .update({ tuya_light_id })
      .eq('name', cleanName)
      .eq('branch', branch);
  }

  res.status(201).json(data[0]);
});

// 儲存場地座標 (供地圖編輯模式使用)
router.put('/:id/polygon', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { polygon_points } = req.body;
  
  const { data: room } = await supabase.from('rooms').select('branch').eq('id', id).single();
  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && (!room || room.branch !== req.user.branch)) {
    return res.status(403).json({ error: '您無權管理此據點的場地座標' });
  }

  const { data, error } = await supabase
    .from('rooms')
    .update({ polygon_points })
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// 獲取特定空間某日的借用記錄
router.get('/:id/bookings', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  let query = supabase.from('bookings').select('start_time, end_time').eq('room_id', id).order('start_time', { ascending: true });
  if (date) query = query.eq('booking_date', date);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch room bookings' });
  res.json(data);
});

// 管理員修改場地
router.put('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { name, capacity, description, image_url, branch, tuya_device_id, tuya_light_id, tuya_ac_id } = req.body;

  if (!name) return res.status(400).json({ error: '場地名稱為必填欄位' });

  const { data: room } = await supabase.from('rooms').select('branch').eq('id', id).single();
  if (!room) return res.status(404).json({ error: '找不到該場地' });

  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && room.branch !== req.user.branch) {
    return res.status(403).json({ error: '您無權修改此據點的場地' });
  }

  const cleanName = sanitizeString(name, 100);
  const cleanDesc = sanitizeString(description, 500);

  // 檢查是否已存在同名場地
  const { data: existing } = await supabase
    .from('rooms')
    .select('id')
    .eq('name', cleanName)
    .eq('branch', room.branch)
    .neq('id', id)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ error: `此據點已存在名為「${cleanName}」的場地，名稱不能重複` });
  }

  const { data, error } = await supabase.from('rooms').update({ name: cleanName, capacity: Number(capacity) || 0, description: cleanDesc, image_url, branch, tuya_device_id, tuya_light_id, tuya_ac_id }).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: 'Failed to update room' });

  // Sync to public_spaces if tuya_light_id is updated
  if (req.body.hasOwnProperty('tuya_light_id')) {
    await supabase
      .from('public_spaces')
      .update({ tuya_light_id })
      .eq('name', cleanName)
      .eq('branch', branch);
  }

  res.json(data);
});

// 管理員批次刪除場地
router.post('/batch-delete', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '請提供要刪除的場地 ID 列表' });
  }

  if (req.user.role !== 'system_admin' && req.user.branch !== '全') {
    const { data: roomsToCheck, error: fetchErr } = await supabase
      .from('rooms')
      .select('branch')
      .in('id', ids);

    if (fetchErr) return res.status(500).json({ error: '取得場地資訊失敗' });
    
    const unauthorized = roomsToCheck.some(r => r.branch !== req.user.branch);
    if (unauthorized) {
      return res.status(403).json({ error: '您無權刪除其他據點的場地' });
    }
  }

  // 1. 刪除預約
  const { error: bookingsDelErr } = await supabase
    .from('bookings')
    .delete()
    .in('room_id', ids);

  if (bookingsDelErr) return res.status(500).json({ error: `刪除場地預約失敗: ${bookingsDelErr.message}` });

  // 2. 刪除場地
  const { error: roomsDelErr } = await supabase
    .from('rooms')
    .delete()
    .in('id', ids);

  if (roomsDelErr) return res.status(500).json({ error: `批次刪除場地失敗: ${roomsDelErr.message}` });

  res.json({ message: '批次刪除成功' });
});

// 管理員刪除場地
router.delete('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { data: room } = await supabase.from('rooms').select('branch').eq('id', id).single();
  if (!room) return res.status(404).json({ error: '找不到該場地' });

  if (req.user.role !== 'system_admin' && req.user.branch !== '全' && room.branch !== req.user.branch) {
    return res.status(403).json({ error: '您無權刪除此據點的場地' });
  }

  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'Failed to delete room' });
  res.json({ message: 'Deleted successfully' });
});

module.exports = router;

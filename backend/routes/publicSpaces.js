const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware, requireRole } = require('../authMiddleware');
const { sanitizeString } = require('../validators');

// 獲取公共空間 (依 sort_order 升序，後依 id 升序)
router.get('/', async (req, res) => {
  const { branch } = req.query;
  let query = supabase.from('public_spaces').select('*').order('sort_order', { ascending: true }).order('id', { ascending: true });
  if (branch) query = query.eq('branch', branch);
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch public spaces' });
  res.json(data);
});

// 管理員新增公共空間
router.post('/', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { name, branch, category, sort_order, tuya_light_id } = req.body;

  if (!name || !branch) return res.status(400).json({ error: '公共空間名稱與據點為必填欄位' });

  if (req.user.role !== 'system_admin' && req.user.branch !== branch) {
    return res.status(403).json({ error: '您無權管理此據點的公共空間' });
  }

  const cleanName = sanitizeString(name, 100);
  const cleanCategory = sanitizeString(category || '空間', 50);

  const insertObj = { name: cleanName, branch, category: cleanCategory, sort_order: Number(sort_order) || 0 };
  if (tuya_light_id !== undefined) {
    insertObj.tuya_light_id = tuya_light_id;
  }

  const { data, error } = await supabase
    .from('public_spaces')
    .insert([insertObj])
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // Sync to rooms if tuya_light_id is set
  if (tuya_light_id) {
    await supabase
      .from('rooms')
      .update({ tuya_light_id })
      .eq('name', cleanName)
      .eq('branch', branch);
  }

  res.status(201).json(data[0]);
});

// 管理員修改公共空間的名稱、分類與排序
router.put('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { name, category, sort_order, branch, tuya_light_id } = req.body;

  if (!name) return res.status(400).json({ error: '公共空間名稱為必填欄位' });

  if (req.user.role !== 'system_admin' && req.user.branch !== branch) {
    return res.status(403).json({ error: '您無權管理此據點的公共空間' });
  }

  const cleanName = sanitizeString(name, 100);
  const cleanCategory = sanitizeString(category, 50);

  const updateObj = { name: cleanName, category: cleanCategory, sort_order: Number(sort_order) || 0 };
  if (req.body.hasOwnProperty('tuya_light_id')) {
    updateObj.tuya_light_id = tuya_light_id;
  }

  const { data, error } = await supabase
    .from('public_spaces')
    .update(updateObj)
    .eq('id', id)
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // Sync to rooms if tuya_light_id is updated
  if (req.body.hasOwnProperty('tuya_light_id')) {
    await supabase
      .from('rooms')
      .update({ tuya_light_id })
      .eq('name', cleanName)
      .eq('branch', branch);
  }

  res.json(data[0]);
});

// 管理員刪除公共空間
router.delete('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;

  // 先查詢該空間以驗證據點權限
  const { data: space, error: fetchError } = await supabase
    .from('public_spaces')
    .select('branch')
    .eq('id', id)
    .single();

  if (fetchError || !space) {
    return res.status(404).json({ error: '找不到該公共空間' });
  }

  if (req.user.role !== 'system_admin' && req.user.branch !== space.branch) {
    return res.status(403).json({ error: '您無權管理此據點的公共空間' });
  }

  const { error } = await supabase
    .from('public_spaces')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '公共空間刪除成功！' });
});

module.exports = router;

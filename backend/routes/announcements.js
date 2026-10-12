const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware, requireRole } = require('../authMiddleware');
const { sanitizeString } = require('../validators');

// 公告系統 (公開讀取)
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to fetch announcements' });
  res.json(data);
});

// 新增公告
router.post('/', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) return res.status(400).json({ error: '公告標題與內容為必填欄位' });

  const cleanTitle = sanitizeString(title, 200);
  const cleanContent = sanitizeString(content, 2000);

  const { data, error } = await supabase.from('announcements').insert({ title: cleanTitle, content: cleanContent, created_by: req.user.id }).select().single();
  if (error) return res.status(500).json({ error: 'Failed to create announcement' });
  res.json(data);
});

// 編輯公告
router.put('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) return res.status(400).json({ error: '公告標題與內容為必填欄位' });

  const cleanTitle = sanitizeString(title, 200);
  const cleanContent = sanitizeString(content, 2000);

  const { data, error } = await supabase
    .from('announcements')
    .update({ title: cleanTitle, content: cleanContent })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update announcement' });
  }
  res.json(data);
});

// 刪除公告
router.delete('/:id', authMiddleware, requireRole(['admin', 'system_admin']), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to delete announcement' });
  }
  res.json({ message: '公告已成功刪除' });
});

module.exports = router;

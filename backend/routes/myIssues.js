const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware } = require('../authMiddleware');

// 獲取使用者自己回報的場地問題
router.get('/', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('room_issues')
    .select('*, rooms!inner(name, branch)')
    .eq('reported_by', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to fetch my issues' });
  res.json(data);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware } = require('../authMiddleware');

// 取得當前使用者 Profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('full_name, phone, pastoral_zone')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(error);
      return res.status(500).json({ error: '取得個人資料失敗' });
    }
    
    res.json(data || {});
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 新增或更新個人 Profile
router.put('/', authMiddleware, async (req, res) => {
  const { fullName, phone, pastoralZone } = req.body;
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: '常用借用人姓名為必填欄位' });
  }
  try {
    const userId = req.user.id;
    
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        phone: phone,
        pastoral_zone: pastoralZone,
        updated_at: new Date()
      });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: '儲存個人資料失敗' });
    }
    
    res.json({ message: '個人資料儲存成功' });
  } catch (err) {
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 取得個人檔案 (supabase profiles + user role/email/branch)
router.get('/me', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('user_profiles').select('*').eq('id', req.user.id).single();
  if (error && error.code === 'PGRST116') {
    return res.json({ role: req.user.role, email: req.user.email, branch: req.user.branch });
  }
  if (error) return res.status(500).json({ error: 'Failed to fetch profile' });
  res.json({ ...data, role: req.user.role, email: req.user.email, branch: req.user.branch });
});

module.exports = router;

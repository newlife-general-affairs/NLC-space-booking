const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { authMiddleware, requireRole } = require('../authMiddleware');
const { isAllowed, ALLOWED_ROLES, ALLOWED_BRANCHES } = require('../validators');

// 人員權限管理 (system_admin only)
router.get('/roles', authMiddleware, requireRole(['system_admin']), async (req, res) => {
  try {
    const { data: roles, error: rErr } = await supabase.from('user_roles').select('id, email, role, branch');
    if (rErr) return res.status(500).json({ error: 'Failed to fetch user roles' });

    const { data: profiles, error: pErr } = await supabase.from('user_profiles').select('id, full_name');
    if (pErr) return res.status(500).json({ error: 'Failed to fetch user profiles' });

    const profileMap = {};
    if (profiles) {
      profiles.forEach(p => {
        profileMap[p.id] = p.full_name;
      });
    }

    const merged = roles.map(r => ({
      ...r,
      full_name: profileMap[r.id] || null
    }));

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

router.put('/roles/:id', authMiddleware, requireRole(['system_admin']), async (req, res) => {
  const { role, branch } = req.body;

  // 白名單驗證：防止任意角色被寫入
  if (role && !isAllowed(role, ALLOWED_ROLES)) {
    return res.status(400).json({ error: `無效的角色，允許值：${ALLOWED_ROLES.join(', ')}` });
  }

  // 白名單驗證：防止任意據點被寫入（允許 null/空值以清除）
  if (branch && !isAllowed(branch, ALLOWED_BRANCHES)) {
    return res.status(400).json({ error: `無效的據點，允許值：${ALLOWED_BRANCHES.join(', ')}` });
  }

  const updateData = {};
  if (role) updateData.role = role;
  if (branch !== undefined) updateData.branch = branch || null;

  const { data, error } = await supabase
    .from('user_roles')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to update user role' });
  res.json(data);
});

module.exports = router;

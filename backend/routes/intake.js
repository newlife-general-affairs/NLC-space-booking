// routes/intake.js
// Google 表單 → App 自動匯入 webhook。
// 由表單回應試算表的 Apps Script onFormSubmit 觸發器呼叫。
// 認證：X-Intake-Secret header 必須等於 env FORM_INTAKE_SECRET。
// 契約細節見 docs/表單自動匯入-設計報告.md §4。

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { supabase } = require('../database');
const { parseIntake } = require('../intake/formParser');

const MAX_BODY_BYTES = 64 * 1024;
const INTAKE_EMAIL = process.env.FORM_INTAKE_EMAIL || 'form-intake@local';

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ── 密鑰中介層 ──────────────────────────────────────────────
router.use((req, res, next) => {
  const configured = process.env.FORM_INTAKE_SECRET;
  if (!configured) {
    console.error('[intake] FORM_INTAKE_SECRET 未設定，拒絕所有請求');
    return res.status(500).json({ error: 'intake not configured' });
  }
  const provided = req.get('X-Intake-Secret') || '';
  if (!timingSafeEqualStr(provided, configured)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const len = Number(req.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'payload too large' });
  }
  next();
});

// ── POST /api/intake/form ──────────────────────────────────
router.post('/form', async (req, res) => {
  const payload = req.body || {};
  const formResponseId = payload.formResponseId;

  if (!formResponseId || typeof formResponseId !== 'string') {
    return res.status(400).json({ error: 'missing formResponseId' });
  }
  if (!payload.type) {
    return res.status(400).json({ error: 'missing type' });
  }

  try {
    // 1. 冪等：查既有紀錄
    const { data: existing } = await supabase
      .from('form_intake_log')
      .select('form_response_id, created_booking_ids, needs_review, skipped')
      .eq('form_response_id', formResponseId)
      .maybeSingle();

    if (existing) {
      return res.json({
        ok: true,
        formResponseId,
        duplicate: true,
        created: existing.created_booking_ids || [],
        needsReview: existing.needs_review || [],
        skipped: existing.skipped || [],
      });
    }

    // 2. 取場地清單
    const { data: dbRooms, error: roomsErr } = await supabase
      .from('rooms')
      .select('id, name, branch');
    if (roomsErr) throw roomsErr;

    // 3. 解析
    const { drafts, skipped } = parseIntake(payload, dbRooms || []);

    // 4. 逐筆寫入 bookings（status=pending，不做硬性 overlap 擋擋）
    const created = [];
    const needsReview = [];
    const insertSkipped = [...skipped];

    for (const d of drafts) {
      if (!d.room || !d.room.id) {
        insertSkipped.push({ reason: '找不到任何可用場地（含虛擬場地）', raw: d.raw });
        continue;
      }
      const row = {
        room_id: d.room.id,
        user_email: INTAKE_EMAIL,
        booking_date: d.booking_date,
        start_time: d.start_time,
        end_time: d.end_time,
        full_name: (payload.borrower && payload.borrower.name) || null,
        phone: (payload.borrower && payload.borrower.phone) || null,
        pastoral_zone: (payload.borrower && payload.borrower.pastoralZone) || null,
        booking_type: d.booking_type,
        purpose: d.purpose,
        attendance_count: d.attendance_count,
        status: 'pending',
      };
      const { data: ins, error: insErr } = await supabase
        .from('bookings')
        .insert(row)
        .select('id')
        .single();
      if (insErr) {
        insertSkipped.push({ reason: `寫入失敗：${insErr.message}`, raw: d.raw });
        continue;
      }
      created.push(ins.id);
      if (d.needsReview) {
        needsReview.push({ bookingId: ins.id, reason: d.reviewReason, raw: d.raw });
      }
    }

    // 5. 稽核紀錄（UNIQUE(form_response_id) 兼作 race 保護）
    const { error: logErr } = await supabase.from('form_intake_log').insert({
      form_response_id: formResponseId,
      borrower_name: (payload.borrower && payload.borrower.name) || null,
      pastoral_zone: (payload.borrower && payload.borrower.pastoralZone) || null,
      phone: (payload.borrower && payload.borrower.phone) || null,
      form_type: payload.type,
      raw_payload: payload,
      created_booking_ids: created,
      needs_review: needsReview,
      skipped: insertSkipped,
    });
    if (logErr && logErr.code === '23505') {
      // 同時另一個請求已處理過 → 視為重送
      return res.json({ ok: true, formResponseId, duplicate: true, created, needsReview, skipped: insertSkipped });
    }
    if (logErr) console.error('[intake] form_intake_log 寫入失敗:', logErr.message);

    return res.json({
      ok: true,
      formResponseId,
      duplicate: false,
      created,
      needsReview,
      skipped: insertSkipped,
    });
  } catch (err) {
    console.error('[intake] 未預期錯誤:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

module.exports = router;

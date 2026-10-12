// intake/formParser.js
// 把 Google 表單「場地借用表」的提交內容解析成一筆筆 booking 草稿。
// 設計細節見 docs/表單自動匯入-設計報告.md §5。
//
// 輸出草稿欄位：
//   { branch, room, booking_date, start_time, end_time, attendance_count,
//     purpose, booking_type, needsReview, reviewReason, raw }
// room 一定有值（對不到時為該據點的「💒 由教會分配」）。

const {
  findBestMatchingRoom,
  looksLikeRoom,
  isVirtualRoom,
  getChurchAssignedRoom,
} = require('../roomMatch');

const DEFAULT_BRANCH = process.env.FORM_INTAKE_DEFAULT_BRANCH || '仁愛堂';
const FORM_YEAR = Number(process.env.FORM_INTAKE_YEAR) || 2026;

// 週幾 → 週一為 0 的索引
const WEEKDAY_INDEX = {
  一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6, 曰: 6,
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function detectBranch(text) {
  return /士林/.test(text || '') ? '士林堂' : DEFAULT_BRANCH;
}

/** '1500' | '15:00' | '9:30' | '15：00' → 'HH:MM:SS'（失敗回 null） */
function normalizeClock(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/：/g, ':');
  let h;
  let m;
  let mm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (mm) {
    h = +mm[1];
    m = +mm[2];
  } else if ((mm = s.match(/^(\d{1,2})(\d{2})$/))) {
    h = +mm[1];
    m = +mm[2];
  } else if ((mm = s.match(/^(\d{1,2})$/))) {
    h = +mm[1];
    m = 0;
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return `${pad2(h)}:${pad2(m)}:00`;
}

/** '1500-1730' | '15:00~17:30' | '15-17' → { start, end }（失敗回 null） */
function parseTimeRange(field) {
  if (!field) return null;
  const s = String(field).trim().replace(/：/g, ':').replace(/[～~至到]/g, '-');
  const m = s.match(/^(\d{1,2}(?::?\d{2})?)\s*-\s*(\d{1,2}(?::?\d{2})?)$/);
  if (!m) return null;
  const start = normalizeClock(m[1]);
  const end = normalizeClock(m[2]);
  if (!start || !end || start >= end) return null;
  return { start, end };
}

function isCountField(field) {
  return /^\d{1,3}\s*人?$/.test(String(field).trim());
}

/** 週幾欄位：允許 週/星期/禮拜 前綴，可能多個（週六日）→ 回傳索引陣列 */
function parseWeekdayField(field) {
  const s = String(field).trim();
  if (!/^(週|星期|禮拜|周)?[一二三四五六日天曰]{1,3}$/.test(s)) return null;
  const chars = s.replace(/^(週|星期|禮拜|周)/, '').split('');
  const idxs = chars.map((c) => WEEKDAY_INDEX[c]).filter((v) => v !== undefined);
  return idxs.length ? idxs : null;
}

/**
 * 從週欄位「標題」抓日期範圍，例如：
 *   八-3( 8/17-8/23) -借士林堂...    → { start: Date(8/17), end: Date(8/23) }
 *   九-1(8/31-9/06)週三四特會 ...     → { start: Date(8/31), end: Date(9/06) }
 */
function parseWeekLabelRange(label, year) {
  const m = String(label || '').match(
    /(\d{1,2})\s*\/\s*(\d{1,2})\s*[-~至到]\s*(\d{1,2})\s*\/\s*(\d{1,2})/,
  );
  if (!m) return null;
  const sM = +m[1];
  const sD = +m[2];
  const eM = +m[3];
  const eD = +m[4];
  const startYear = year;
  const endYear = eM < sM ? year + 1 : year;
  const start = new Date(startYear, sM - 1, sD);
  const end = new Date(endYear, eM - 1, eD);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

/** 在 [start, end] 這 7 天內，找出 weekday 索引（週一=0）對應的實際日期字串 */
function dateForWeekdayInRange(weekdayIdx, range) {
  const cursor = new Date(range.start);
  for (let i = 0; i < 8 && cursor <= range.end; i += 1) {
    const idx = (cursor.getDay() + 6) % 7; // JS: 0=日 → 週一為0
    if (idx === weekdayIdx) return toDateStr(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/**
 * 解析單行自由文字（格式大致為：週幾 / 時段 / 事由 / 人數 / 場地，順序與分隔符容忍）。
 * @returns { weekdayIdxs, timeRange, count, roomToken, purpose } 各項可能為 null
 */
function parseFreeLine(line, dbRooms, branch) {
  const fields = String(line)
    .replace(/／/g, '/')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  let weekdayIdxs = null;
  let timeRange = null;
  let count = null;
  const leftover = [];

  const consume = (tok) => {
    if (!tok) return true;
    if (!weekdayIdxs) {
      const w = parseWeekdayField(tok);
      if (w) {
        weekdayIdxs = w;
        return true;
      }
    }
    if (!timeRange) {
      const tr = parseTimeRange(tok);
      if (tr) {
        timeRange = tr;
        return true;
      }
    }
    if (count == null && isCountField(tok)) {
      count = parseInt(tok, 10);
      return true;
    }
    return false;
  };

  for (const field of fields) {
    if (consume(field)) continue;
    // 該欄可能是「事由 場地」或「人數 場地」用空白隔開 → 再拆
    const subs = field.split(/\s+/).filter(Boolean);
    if (subs.length > 1) {
      for (const s of subs) {
        if (!consume(s)) leftover.push(s);
      }
    } else {
      leftover.push(field);
    }
  }

  // 從尾端找看起來像場地的 token
  let roomToken = null;
  for (let i = leftover.length - 1; i >= 0; i -= 1) {
    if (looksLikeRoom(leftover[i], dbRooms)) {
      roomToken = leftover[i];
      leftover.splice(i, 1);
      break;
    }
  }
  void branch;

  return {
    weekdayIdxs,
    timeRange,
    count,
    roomToken,
    purpose: leftover.join(' ').trim() || null,
  };
}

/** 把解析結果 + 日期 組成一筆草稿 */
function buildDraft({
  dbRooms,
  branch,
  bookingDate,
  timeRange,
  count,
  roomToken,
  purpose,
  bookingType,
  raw,
  purposePrefix = '',
}) {
  let room = roomToken ? findBestMatchingRoom(roomToken, dbRooms, branch) : null;
  let needsReview = false;
  const reasons = [];

  if (!room || isVirtualRoom(room.name)) {
    needsReview = true;
    if (roomToken) reasons.push(`場地對不到：「${roomToken}」`);
    else reasons.push('未指明場地');
    room = getChurchAssignedRoom(dbRooms, branch);
  }
  if (count == null) {
    needsReview = true;
    reasons.push('未填人數');
  }

  // 時段欄位 NOT NULL：沒有時段時暫記為全天，並標記待確認
  const hasTime = !!timeRange;
  if (!hasTime) {
    needsReview = true;
    reasons.push('未填時段（暫記全天 00:00-23:59）');
  }

  // 日期欄位 NOT NULL：解析不到時暫記今天
  let safeDate = bookingDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate || '')) {
    safeDate = toDateStr(new Date());
    needsReview = true;
    reasons.push('未能判斷日期（暫記今天）');
  }

  const fullPurpose =
    (needsReview ? '【待人工確認】' : '') +
    (purposePrefix ? `${purposePrefix} ` : '') +
    (purpose || raw || '(無說明)');

  return {
    branch,
    room,
    booking_date: safeDate,
    start_time: hasTime ? timeRange.start : '00:00:00',
    end_time: hasTime ? timeRange.end : '23:59:00',
    attendance_count: count == null ? null : count,
    purpose: fullPurpose.slice(0, 300),
    booking_type: bookingType,
    needsReview,
    reviewReason: reasons.join('；'),
    raw,
  };
}

// ── 分支 1：一般借用 ────────────────────────────────────────────
function parseGeneral(payload, dbRooms, out) {
  const weeks = (payload.general && payload.general.weeks) || [];
  for (const wk of weeks) {
    const text = (wk && wk.text) || '';
    if (!text.trim()) continue;
    const range = parseWeekLabelRange(wk.label, FORM_YEAR);

    const lines = text
      .split(/[\r\n]+|；|;/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const line of lines) {
      // 據點只看該行文字本身；週欄位標題固定含「借士林堂請在位置寫士林」不能拿來判斷
      const branch = detectBranch(line);
      const p = parseFreeLine(line, dbRooms, branch);

      if (!p.timeRange) {
        out.skipped.push({ reason: '無法辨識時段', raw: line });
        continue;
      }
      if (!range) {
        out.skipped.push({ reason: `週欄位標題無日期範圍：「${wk.label}」`, raw: line });
        continue;
      }
      if (!p.weekdayIdxs) {
        out.skipped.push({ reason: '無法辨識週幾', raw: line });
        continue;
      }

      const idxs = p.weekdayIdxs.slice(0, 1); // P1：一行只取第一個週幾
      if (p.weekdayIdxs.length > 1) {
        out.needsReviewNote = true;
      }
      for (const wIdx of idxs) {
        const bookingDate = dateForWeekdayInRange(wIdx, range);
        if (!bookingDate) {
          out.skipped.push({ reason: '週幾換算日期失敗', raw: line });
          continue;
        }
        out.drafts.push(
          buildDraft({
            dbRooms,
            branch,
            bookingDate,
            timeRange: p.timeRange,
            count: p.count,
            roomToken: p.roomToken,
            purpose: p.purpose,
            bookingType: '一般借用',
            raw: line,
          }),
        );
      }
    }
  }
}

// ── 分支 2：婚禮＆重要 ──────────────────────────────────────────
function parseWedding(payload, dbRooms, out) {
  const w = payload.wedding || {};
  const bookingType = w.content === '特殊活動＆場地' ? '重要' : '婚禮';
  const eventName = (w.eventName || '').trim();
  const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(w.date || '') ? w.date : null;
  const baseRange = baseDate
    ? (() => {
        const d = new Date(`${baseDate}T00:00:00`);
        const mondayOffset = (d.getDay() + 6) % 7;
        const start = new Date(d);
        start.setDate(d.getDate() - mondayOffset);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { start, end };
      })()
    : null;

  const lines = String(w.slotsText || '')
    .split(/[\r\n]+|；|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    out.drafts.push(
      buildDraft({
        dbRooms,
        branch: detectBranch(w.slotsText || ''),
        bookingDate: baseDate,
        timeRange: null,
        count: null,
        roomToken: null,
        purpose: w.slotsText || eventName,
        bookingType,
        raw: JSON.stringify(w),
        purposePrefix: eventName ? `【${eventName}】` : '',
      }),
    );
    return;
  }

  for (const line of lines) {
    const branch = detectBranch(line);
    const p = parseFreeLine(line, dbRooms, branch);
    let bookingDate = baseDate;
    if (p.weekdayIdxs && baseRange) {
      bookingDate = dateForWeekdayInRange(p.weekdayIdxs[0], baseRange) || baseDate;
    }
    if (!p.timeRange && !bookingDate) {
      out.skipped.push({ reason: '婚禮行無時段也無日期', raw: line });
      continue;
    }
    out.drafts.push(
      buildDraft({
        dbRooms,
        branch,
        bookingDate,
        timeRange: p.timeRange,
        count: p.count,
        roomToken: p.roomToken,
        purpose: p.purpose,
        bookingType,
        raw: line,
        purposePrefix: eventName ? `【${eventName}】` : '',
      }),
    );
  }
}

// ── 分支 3：取消＆異動 ─────────────────────────────────────────
function parseChangeRequest(payload, dbRooms, out) {
  const c = payload.changeReq || {};
  const today = toDateStr(new Date());
  const text =
    c.mode === '取消'
      ? `【取消】${c.cancelRoom || ''}｜原因：${c.cancelReason || ''}`
      : `【異動】${c.updateInfo || ''}｜原因：${c.updateReason || ''}`;

  // 嘗試從文字抓日期 YYYY-MM-DD 或 M/D
  let bookingDate = today;
  const isoM = (c.updateInfo || c.cancelRoom || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  const mdM = (c.updateInfo || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (isoM) bookingDate = `${isoM[1]}-${pad2(+isoM[2])}-${pad2(+isoM[3])}`;
  else if (mdM) bookingDate = `${FORM_YEAR}-${pad2(+mdM[1])}-${pad2(+mdM[2])}`;

  const branch = detectBranch(text);
  const roomToken = c.cancelRoom || null;
  const draft = buildDraft({
    dbRooms,
    branch,
    bookingDate,
    timeRange: null,
    count: null,
    roomToken,
    purpose: text,
    bookingType: '取消或異動',
    raw: JSON.stringify(c),
  });
  draft.needsReview = true;
  draft.reviewReason = ['取消/異動需人工處理', draft.reviewReason].filter(Boolean).join('；');
  if (!draft.purpose.startsWith('【待人工確認】')) {
    draft.purpose = `【待人工確認】${draft.purpose}`.slice(0, 300);
  }
  out.drafts.push(draft);
}

/**
 * @param {object} payload  Apps Script 送來的表單內容
 * @param {Array}  dbRooms  rooms 全表 [{id,name,branch,...}]
 * @returns {{ drafts: Array, skipped: Array }}
 */
function parseIntake(payload, dbRooms) {
  const out = { drafts: [], skipped: [] };
  const type = (payload && payload.type) || '';

  if (type.includes('婚禮') || type.includes('重要')) {
    parseWedding(payload, dbRooms, out);
  } else if (type.includes('取消') || type.includes('異動')) {
    parseChangeRequest(payload, dbRooms, out);
  } else {
    // 預設當一般借用（type 為「一般借用」或空白）
    parseGeneral(payload, dbRooms, out);
  }

  return out;
}

module.exports = {
  parseIntake,
  // 匯出小工具供測試
  _internals: {
    parseTimeRange,
    normalizeClock,
    parseWeekdayField,
    parseWeekLabelRange,
    dateForWeekdayInRange,
    parseFreeLine,
    detectBranch,
  },
};

// ============================================================
// validators.js — 集中式輸入驗證與清理模組
// 防止惡意資料寫入資料庫，降低 XSS 與注入風險
// ============================================================

// ── 白名單常數 ──────────────────────────────────────────────

/** 允許的使用者角色 */
const ALLOWED_ROLES = ['user', 'admin', 'system_admin', 'inspector'];

/** 允許的借用類型 */
const ALLOWED_BOOKING_TYPES = ['一般借用', '婚禮', '重要', '取消或異動'];

/** 管理端允許變更的預約狀態 */
const ALLOWED_BOOKING_STATUSES = ['approved', 'rejected'];

/** 允許的問題狀態 */
const ALLOWED_ISSUE_STATUSES = ['open', 'in_progress', 'resolved'];

/** 允許的據點名稱（與前端 constants.ts 同步） */
const ALLOWED_BRANCHES = ['仁愛堂', '士林堂', '新莊', '大福', '全'];

// ── 字串清理 ────────────────────────────────────────────────

/**
 * 去頭尾空白並截斷至最大長度，防止超長輸入造成資料庫污染或 DoS。
 * @param {any} value - 輸入值
 * @param {number} maxLen - 允許的最大長度（字元數）
 * @returns {string} 清理後的字串
 */
const sanitizeString = (value, maxLen = 500) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().substring(0, maxLen);
};

// ── 格式驗證 ─────────────────────────────────────────────────

/**
 * 驗證日期格式是否為 YYYY-MM-DD
 * @param {string} str
 * @returns {boolean}
 */
const isValidDate = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
};

/**
 * 驗證時間格式是否為 HH:MM
 * @param {string} str
 * @returns {boolean}
 */
const isValidTime = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^\d{2}:\d{2}$/.test(str);
};

/**
 * 驗證值是否在允許的白名單清單中
 * @param {any} value
 * @param {Array} allowedList
 * @returns {boolean}
 */
const isAllowed = (value, allowedList) => {
  return allowedList.includes(value);
};

// ── 匯出 ─────────────────────────────────────────────────────

module.exports = {
  ALLOWED_ROLES,
  ALLOWED_BOOKING_TYPES,
  ALLOWED_BOOKING_STATUSES,
  ALLOWED_ISSUE_STATUSES,
  ALLOWED_BRANCHES,
  sanitizeString,
  isValidDate,
  isValidTime,
  isAllowed,
};

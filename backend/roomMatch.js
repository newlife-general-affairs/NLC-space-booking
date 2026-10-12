// roomMatch.js
// 場地名稱模糊比對工具。
//
// 注意：此檔目前是 routes/rooms.js 內同名函式的整理版複本，供表單自動匯入
// (routes/intake.js) 使用。routes/rooms.js 的季度排表匯入尚未改用本檔，
// 待有完整測試時再統一（見 docs/表單自動匯入-設計報告.md P2）。

/**
 * 把場地名稱正規化成「特徵字串」：拿掉據點、把國字數字轉阿拉伯數字、
 * 去掉「互動區/教室/區塊/第…」等修飾詞與所有分隔符。
 */
function getFeatureKey(s) {
  let val = String(s || '').toLowerCase().trim();
  val = val.replace(/(仁愛堂|士林堂|新莊堂|大福堂)/g, '');
  const numMap = {
    一: '1', 二: '2', 三: '3', 四: '4', 五: '5',
    六: '6', 七: '7', 八: '8', 九: '9', 十: '10',
  };
  for (const [zh, en] of Object.entries(numMap)) {
    val = val.replace(new RegExp(zh, 'g'), en);
  }
  val = val.replace(/(互動區|教室|區塊|第|區|座位|區域|沙發區|中間)/g, '');
  val = val.replace(/[-_\s+、,，&()（）]/g, '');
  return val;
}

const ALIAS_MAP = {
  b25: 'B2-第五教室',
  第五教室: 'B2-第五教室',
  五教: 'B2-第五教室',
  b2五教: 'B2-第五教室',
  'b2-5': 'B2-第五教室',
  b21: 'B2-第一教室',
  第一教室: 'B2-第一教室',
  一教: 'B2-第一教室',
  'b2-1': 'B2-第一教室',
  b22: 'B2-第二教室',
  第二教室: 'B2-第二教室',
  二教: 'B2-第二教室',
  'b2-2': 'B2-第二教室',
  b23: 'B2-第三教室',
  第三教室: 'B2-第三教室',
  三教: 'B2-第三教室',
  'b2-3': 'B2-第三教室',
  b24: 'B2-第四教室',
  第四教室: 'B2-第四教室',
  四教: 'B2-第四教室',
  'b2-4': 'B2-第四教室',
  b1大會堂: 'B1-會堂',
  大會堂: 'B1-會堂',
  會堂: 'B1-會堂',
  仁愛會堂: 'B1-會堂',
  副堂: 'B1-副堂',
  b1副堂: 'B1-副堂',
  b2走廊: 'B2-走道',
  b2走道: 'B2-走道',
  'b2-走廊': 'B2-走道',
  走廊: 'B2-走道',
  走道: 'B2-走道',
  豆腐: 'B2-豆腐區',
  豆腐區: 'B2-豆腐區',
  b2豆腐: 'B2-豆腐區',
  b2豆腐區: 'B2-豆腐區',
  廚房: 'B2-廚房前',
  廚房前: 'B2-廚房前',
  b2廚房: 'B2-廚房前',
  b11: 'B1-互動區-一',
  b12: 'B1-互動區第2區塊',
  b13: 'B1-互動區-三',
  b14: 'B1-互動區第4區塊',
  b15: 'B1-互動區第5區塊',
  b16: 'B1-互動區第6區塊',
};

const ALIAS_KEYS = new Set(Object.keys(ALIAS_MAP));

function normKeyOf(s) {
  return String(s || '').toLowerCase().replace(/[-_\s]/g, '');
}

/**
 * 從 dbRooms 中找出最符合 rawName 的場地。優先同據點、再跨據點；
 * 依「精準名稱 → 別名表 → 特徵值 → 模糊包含」順序比對。
 * 全部落空時回傳該據點（或任一）的「💒 由教會分配」，再不行回傳 dbRooms[0]。
 *
 * @param {string} rawName
 * @param {Array<{id:number,name:string,branch:string}>} dbRooms
 * @param {string} branch  優先比對的據點
 * @returns {object|null}
 */
function findBestMatchingRoom(rawName, dbRooms, branch) {
  if (!rawName) return null;

  const cleanName = String(rawName).trim();
  if (!cleanName) return null;

  const normKey = normKeyOf(cleanName);
  const aliasTargetName = ALIAS_MAP[normKey];
  const rawFeature = getFeatureKey(cleanName);

  // ── 同據點優先 ──
  let match = dbRooms.find((r) => r.name === cleanName && r.branch === branch);
  if (match) return match;

  if (aliasTargetName) {
    match = dbRooms.find((r) => r.name === aliasTargetName && r.branch === branch);
    if (match) return match;
  }

  if (rawFeature) {
    match = dbRooms.find((r) => r.branch === branch && getFeatureKey(r.name) === rawFeature);
    if (match) return match;
  }

  match = dbRooms.find(
    (r) => r.branch === branch && (r.name.includes(cleanName) || cleanName.includes(r.name)),
  );
  if (match) return match;

  if (rawFeature) {
    match = dbRooms.find(
      (r) =>
        r.branch === branch &&
        (rawFeature.includes(getFeatureKey(r.name)) || getFeatureKey(r.name).includes(rawFeature)),
    );
    if (match) return match;
  }

  // ── 跨據點次之 ──
  match = dbRooms.find((r) => r.name === cleanName);
  if (match) return match;

  if (aliasTargetName) {
    match = dbRooms.find((r) => r.name === aliasTargetName);
    if (match) return match;
  }

  if (rawFeature) {
    match = dbRooms.find((r) => getFeatureKey(r.name) === rawFeature);
    if (match) return match;
  }

  match = dbRooms.find((r) => r.name.includes(cleanName) || cleanName.includes(r.name));
  if (match) return match;

  if (rawFeature) {
    match = dbRooms.find(
      (r) => rawFeature.includes(getFeatureKey(r.name)) || getFeatureKey(r.name).includes(rawFeature),
    );
    if (match) return match;
  }

  // ── 兜底：由教會分配 ──
  match = dbRooms.find((r) => r.name.includes('由教會分配') && r.branch === branch);
  if (match) return match;

  match = dbRooms.find((r) => r.name.includes('由教會分配'));
  if (match) return match;

  return dbRooms[0] || null;
}

/**
 * 粗略判斷一個 token 看起來是不是場地代號 / 名稱。
 */
function isRoomToken(token, dbRooms) {
  const t = String(token || '').toLowerCase().trim();
  if (!t) return false;

  if (t.match(/(b1|b2|會堂|副堂|教室|走廊|走道|豆腐|互動|區塊|區|廚房|新娘|分配|堂)/i)) {
    return true;
  }

  const roomKeywords = [
    'b21', 'b22', 'b23', 'b24', 'b25', 'b11', 'b12', 'b13', 'b14', 'b15', 'b16',
    'b2-1', 'b2-2', 'b2-3', 'b2-4', 'b2-5', 'b1-1', 'b1-2', 'b1-3', 'b1-4', 'b1-5', 'b1-6',
  ];
  if (roomKeywords.includes(t)) return true;

  if (dbRooms.some((r) => r.name !== '💒 由教會分配' && r.name.toLowerCase() === t)) {
    return true;
  }

  return false;
}

/**
 * 比 isRoomToken 更寬：token 命中別名表也算「看起來像場地」。
 * 用於自由文字斷詞時判斷某個片段是不是場地欄位。
 */
function looksLikeRoom(token, dbRooms) {
  if (isRoomToken(token, dbRooms)) return true;
  return ALIAS_KEYS.has(normKeyOf(token));
}

/** 判斷場地是否為「💒 由教會分配」虛擬場地 */
function isVirtualRoom(name) {
  return !!name && name.includes('由教會分配');
}

/** 取某據點的「💒 由教會分配」場地；找不到再取任一據點的 */
function getChurchAssignedRoom(dbRooms, branch) {
  return (
    dbRooms.find((r) => isVirtualRoom(r.name) && r.branch === branch) ||
    dbRooms.find((r) => isVirtualRoom(r.name)) ||
    null
  );
}

module.exports = {
  getFeatureKey,
  findBestMatchingRoom,
  isRoomToken,
  looksLikeRoom,
  isVirtualRoom,
  getChurchAssignedRoom,
};

// ============================================================
// roomGrid.ts — 場地看板網格共用工具
// 場地父子關係展開、欄位排序、時段分桶。供借用概況與衝突拖曳看板共用。
// ============================================================

export interface RoomLike {
  id: number;
  name: string;
  parent_room_id?: number | null;
}

/** 虛擬場地「💒 由教會分配」的名稱標記 */
export const VIRTUAL_ROOM_MARK = '由教會分配';

export function isVirtualRoom(name: string | undefined | null): boolean {
  return !!name && name.includes(VIRTUAL_ROOM_MARK);
}

/**
 * 取得與某場地「衝突相關」的場地 id 集合：自己 + 父場地 + 所有子場地。
 * 與後端 /api/bookings/check-all 的父子擴張邏輯一致。
 */
export function getRelatedRoomIds(roomId: number, rooms: RoomLike[]): Set<number> {
  const related = new Set<number>([roomId]);
  const self = rooms.find((r) => r.id === roomId);
  if (self?.parent_room_id) related.add(self.parent_room_id);
  rooms.forEach((r) => {
    if (r.parent_room_id === roomId) related.add(r.id);
  });
  return related;
}

/**
 * 依 localStorage 儲存的自訂順序排序場地（與 WeeklyBulletin 相同的鍵與規則）。
 * 找不到自訂順序時，回傳原陣列的複本。
 */
export function applyStoredRoomOrder<T extends RoomLike>(rooms: T[], branch: string): T[] {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(`room_order_${branch}`);
  } catch {
    stored = null;
  }
  if (!stored) return [...rooms];

  try {
    const orderIds = JSON.parse(stored) as number[];
    const orderMap = new Map<number, number>();
    orderIds.forEach((id, index) => orderMap.set(id, index));
    return [...rooms].sort((a, b) => {
      const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
      const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
      if (ai !== bi) return ai - bi;
      return a.id - b.id;
    });
  } catch {
    return [...rooms];
  }
}

// ── 時段分桶 ────────────────────────────────────────────────
// 與 WeeklyBulletin 的看板列一致：平日 4 段、週末 5 段。

export const WEEKDAY_ROWS = ['晨', '上午', '下午', '晚上'] as const;
export const WEEKEND_ROWS = ['晨', '08:00 - 12:00', '12:00 - 15:00', '15:00 - 18:00', '18:00 ~'] as const;

export type TimeRow = string;

/** dayIdx: 0=一 … 6=日；週一～週五為平日 */
export function isWeekdayIndex(dayIdx: number): boolean {
  return dayIdx <= 4;
}

/** 由 JS Date.getDay()（0=日）換算成本專案的 dayIdx（0=一 … 6=日） */
export function toMondayFirstIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** 以本地時間格式化為 yyyy-mm-dd */
export function fmtLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 給定日期（yyyy-mm-dd），回傳所屬「週一為首」那一週的 7 個日期字串 */
export function weekDatesMondayFirst(dateStr: string): string[] {
  const d = new Date(`${dateStr}T00:00:00`);
  const jsDay = d.getDay();
  const diff = d.getDate() - jsDay + (jsDay === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return fmtLocalDate(x);
  });
}

/** 該日期是否為平日（週一～週五） */
export function isWeekdayDate(dateStr: string): boolean {
  const jsDay = new Date(`${dateStr}T00:00:00`).getDay();
  return isWeekdayIndex(toMondayFirstIndex(jsDay));
}

/**
 * 該預約是否已結束（現在時間已過結束時刻）。
 * 結束時間為 00:00 視為隔天凌晨。解析失敗時回傳 false（保守顯示）。
 */
export function isBookingPast(dateStr: string, endTimeStr: string): boolean {
  try {
    const [hours, minutes] = endTimeStr.substring(0, 5).split(':').map(Number);
    let targetDateStr = dateStr;
    if (hours === 0 && minutes === 0) {
      const nextDay = new Date(`${dateStr}T00:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      targetDateStr = fmtLocalDate(nextDay);
    }
    const end = new Date(
      `${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
    );
    return new Date() > end;
  } catch {
    return false;
  }
}

export function getTimeRows(isWeekday: boolean): TimeRow[] {
  return isWeekday ? [...WEEKDAY_ROWS] : [...WEEKEND_ROWS];
}

/** 依開始時間（HH:MM[:SS]）判斷落在哪個時段列 */
export function bucketOfStartTime(startTime: string, isWeekday: boolean): TimeRow {
  const t = startTime.substring(0, 5);
  if (isWeekday) {
    if (t < '08:00') return '晨';
    if (t < '12:00') return '上午';
    if (t < '17:00') return '下午';
    return '晚上';
  }
  if (t < '08:00') return '晨';
  if (t < '12:00') return '08:00 - 12:00';
  if (t < '15:00') return '12:00 - 15:00';
  if (t < '18:00') return '15:00 - 18:00';
  return '18:00 ~';
}

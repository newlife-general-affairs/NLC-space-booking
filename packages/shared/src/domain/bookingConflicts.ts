// ============================================================
// bookingConflicts.ts — 預約時段衝突判定（前端共用）
// 從 BookingsTab 的 overlapMap 計算抽出，供衝突列表與拖曳看板共用。
// ============================================================
import { isBookingPast } from './roomGrid';
import type { Booking } from '../types';

export interface ConflictPeer {
  id: number;
  roomName: string;
  borrower: string;
  time: string;
  purpose: string;
  status: string;
}

export interface ConflictInfo {
  type: 'conflict';
  index: number;
  total: number;
  conflictingWith: ConflictPeer[];
}

export type OverlapMap = Record<number, ConflictInfo>;

/** 兩個時段（HH:MM[:SS] 字串）是否重疊 */
export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * 計算「同一天 → 同一場地 → 時段重疊」的衝突分群。
 * 已拒絕（rejected）與已結束（過期）的預約不參與 —— 過期的預約不再視為待處理衝突。
 * 回傳每筆衝突預約的順位與對手清單。
 */
export function computeOverlapMap(data: Booking[]): OverlapMap {
  const overlapMap: OverlapMap = {};

  const activeBookings = data.filter(
    (b) => b.status !== 'rejected' && !isBookingPast(b.booking_date, b.end_time),
  );
  const dateMap: Record<string, Booking[]> = {};
  activeBookings.forEach((b) => {
    if (!dateMap[b.booking_date]) dateMap[b.booking_date] = [];
    dateMap[b.booking_date].push(b);
  });

  for (const date in dateMap) {
    const dayBookings = dateMap[date];
    const roomMap: Record<number, Booking[]> = {};
    dayBookings.forEach((b) => {
      const rId = b.room_id || 0;
      if (!roomMap[rId]) roomMap[rId] = [];
      roomMap[rId].push(b);
    });

    for (const rIdStr in roomMap) {
      const roomBookings = roomMap[rIdStr];
      const sortedByTime = [...roomBookings].sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
      );
      const roomClusters: Booking[][] = [];

      for (const b of sortedByTime) {
        let added = false;
        for (const cluster of roomClusters) {
          const clusterStart = cluster.reduce(
            (min, cur) => (cur.start_time < min ? cur.start_time : min),
            cluster[0].start_time,
          );
          const clusterEnd = cluster.reduce(
            (max, cur) => (cur.end_time > max ? cur.end_time : max),
            cluster[0].end_time,
          );
          if (b.start_time < clusterEnd && b.end_time > clusterStart) {
            cluster.push(b);
            added = true;
            break;
          }
        }
        if (!added) roomClusters.push([b]);
      }

      for (const cluster of roomClusters) {
        if (cluster.length > 1) {
          cluster.sort((x, y) => {
            const timeX = x.created_at || '';
            const timeY = y.created_at || '';
            if (timeX && timeY && timeX !== timeY) return timeX.localeCompare(timeY);
            return (x.id || 0) - (y.id || 0);
          });
          cluster.forEach((b, index) => {
            const others = cluster
              .filter((x) => x.id !== b.id)
              .map((x) => ({
                id: x.id,
                roomName: x.rooms?.name || '未知場地',
                borrower: x.full_name || '未知借用人',
                time: `${x.start_time?.substring(0, 5)}-${x.end_time?.substring(0, 5)}`,
                purpose: x.purpose || '',
                status: x.status,
              }));
            overlapMap[b.id] = {
              type: 'conflict',
              index,
              total: cluster.length,
              conflictingWith: others,
            };
          });
        }
      }
    }
  }

  return overlapMap;
}

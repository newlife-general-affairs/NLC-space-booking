import type { Booking } from '@church/shared/types';
import { isBookingPast } from '@church/shared/domain/roomGrid';
import type { OverlapMap } from '@church/shared/domain/bookingConflicts';

export { isBookingPast };

export interface CleaningState {
  /** 指派的公共空間文字（cleaning_assignments 第一段） */
  assignedText: string;
  /** 打掃流程狀態（cleaning_assignments 第二段） */
  state: string;
  /** 借用人已回報打掃完成，等待檢查 */
  isSubmitted: boolean;
  /** 檢查退回，等待借用人改善 */
  isRejected: boolean;
}

// cleaning_assignments 格式：`<指派空間>::<狀態>::<進度>`
export function parseCleaning(b: Booking): CleaningState {
  const parts = (b.cleaning_assignments || '').split('::');
  const state = parts[1] || '';
  return {
    assignedText: parts[0] || '',
    state,
    isSubmitted: state === 'submitted' || state === 'resubmitted',
    isRejected: state === 'rejected',
  };
}

/** 借用結束超過 1 小時仍未歸還，視為逾期（不再列入待辦） */
export function isReturnOverdue(dateStr: string, endTimeStr: string): boolean {
  try {
    const [parsedHours, minutes] = endTimeStr.substring(0, 5).split(':').map(Number);
    let hours = parsedHours + 1;
    let targetDateStr = dateStr;
    if (hours >= 24) {
      hours -= 24;
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      targetDateStr = nextDay.toISOString().split('T')[0];
    }
    const overdueTime = new Date(`${targetDateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    return new Date() > overdueTime;
  } catch {
    return false;
  }
}

export function hasStarted(dateStr: string, startTimeStr: string): boolean {
  try {
    const [hours, minutes] = startTimeStr.substring(0, 5).split(':').map(Number);
    const start = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    return new Date() >= start;
  } catch {
    return false;
  }
}

export type CleaningStage = 'to-assign' | 'assigned' | 'to-inspect' | 'done';

/** 已核可預約目前在清潔流程中的哪一段；未核可回傳 null */
export function getCleaningStage(b: Booking): CleaningStage | null {
  if (b.status !== 'approved') return null;
  const { assignedText, isSubmitted, isRejected } = parseCleaning(b);
  if (b.is_returned || isReturnOverdue(b.booking_date, b.end_time)) return 'done';
  if (isSubmitted || isRejected) return 'to-inspect';
  return assignedText ? 'assigned' : 'to-assign';
}

export type ReviewStage = 'pending' | 'conflict' | 'approved' | 'expired';

/** 預約在審核流程中的分類；已拒絕回傳 null */
export function getReviewStage(b: Booking, overlapMap: OverlapMap): ReviewStage | null {
  if (b.status === 'approved') return 'approved';
  if (b.status !== 'pending') return null;
  if (isBookingPast(b.booking_date, b.end_time)) return 'expired';
  return overlapMap[b.id] ? 'conflict' : 'pending';
}

export function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
}

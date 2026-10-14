import { useCallback, useEffect, useState } from 'react';
import { apiFetchAdminBookings, apiFetchAdminIssues, apiFetchFormIntake } from '@church/shared/api';
import { computeOverlapMap } from '@church/shared/domain/bookingConflicts';
import type { Booking, Issue } from '@church/shared/types';
import { getCleaningStage, getReviewStage } from '../domain/bookingStatus';
import type { PageId } from '../navigation';

export interface ConsoleTodos {
  pendingReview: number;
  conflicts: number;
  cleaningToAssign: number;
  cleaningToInspect: number;
  openIssues: number;
  unresolvedIntake: number;
}

const EMPTY: ConsoleTodos = {
  pendingReview: 0,
  conflicts: 0,
  cleaningToAssign: 0,
  cleaningToInspect: 0,
  openIssues: 0,
  unresolvedIntake: 0,
};

export function summarizeTodos(bookings: Booking[], issues: Issue[], unresolvedIntake: number): ConsoleTodos {
  const overlapMap = computeOverlapMap(bookings);
  const todos = { ...EMPTY, unresolvedIntake };
  bookings.forEach(b => {
    const review = getReviewStage(b, overlapMap);
    if (review === 'pending') todos.pendingReview += 1;
    if (review === 'conflict') todos.conflicts += 1;
    const cleaning = getCleaningStage(b);
    if (cleaning === 'to-assign') todos.cleaningToAssign += 1;
    if (cleaning === 'to-inspect') todos.cleaningToInspect += 1;
  });
  todos.openIssues = issues.filter(i => i.status !== 'resolved').length;
  return todos;
}

/** 側邊欄徽章：每個頁面要顯示的待辦數 */
export function badgeFor(page: PageId, todos: ConsoleTodos): number {
  switch (page) {
    case 'bookings-review': return todos.pendingReview + todos.conflicts;
    case 'bookings-form-intake': return todos.unresolvedIntake;
    case 'onsite-cleaning': return todos.cleaningToInspect;
    case 'onsite-issues': return todos.openIssues;
    default: return 0;
  }
}

export function useConsoleTodos(branch: string, isStaff: boolean, getToken: () => string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [todos, setTodos] = useState<ConsoleTodos>(EMPTY);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [rawBookings, rawIssues, rawIntake] = await Promise.all([
        apiFetchAdminBookings(token, branch),
        apiFetchAdminIssues(token, branch),
        // 表單匯入紀錄只有管理員有權限讀取
        isStaff ? apiFetchFormIntake(token, 'unresolved') : Promise.resolve([]),
      ]);
      const nextBookings: Booking[] = Array.isArray(rawBookings) ? rawBookings : [];
      const nextIssues: Issue[] = Array.isArray(rawIssues) ? rawIssues : [];
      const intakeCount = Array.isArray(rawIntake) ? rawIntake.length : 0;
      setBookings(nextBookings);
      setIssues(nextIssues);
      setTodos(summarizeTodos(nextBookings, nextIssues, intakeCount));
    } catch (err) {
      console.error('Failed to load console todos:', err);
    }
  }, [branch, isStaff, getToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bookings, issues, todos, refresh };
}

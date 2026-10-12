import { useState } from 'react';
import type { Booking, Issue, StatusMsg } from '@church/shared/types';
import { apiCreateIssue, apiFetchMyIssues } from '@church/shared/api';

interface UseIssueReportOptions {
  getToken: () => string;
  onSuccess: () => void;
}

export function useIssueReport({ getToken, onSuccess }: UseIssueReportOptions) {
  const [selectedIssueTarget, setSelectedIssueTarget] = useState('');
  const [reportingBooking, setReportingBooking] = useState<Booking | null>(null);
  const [userIssues, setUserIssues] = useState<Issue[]>([]);
  const [issueDescription, setIssueDescription] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueStatusMsg, setIssueStatusMsg] = useState<StatusMsg>({ type: '', text: '' });

  const fetchUserIssues = () => {
    apiFetchMyIssues(getToken())
      .then(data => setUserIssues(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const getSelectableItems = () => {
    if (!reportingBooking) return [];
    const items: { value: string; label: string }[] = [];
    if (reportingBooking.room_id && reportingBooking.room_name) {
      items.push({ value: `room_${reportingBooking.room_id}`, label: reportingBooking.room_name });
    }
    if (reportingBooking.cleaning_assignments && typeof reportingBooking.cleaning_assignments === 'string') {
      reportingBooking.cleaning_assignments
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(space => {
          items.push({ value: `ps_${reportingBooking.room_id}_${space}`, label: `🧹 公共空間 - ${space}` });
        });
    }
    return items;
  };

  const startReporting = (booking: Booking) => {
    setReportingBooking(booking);
    setSelectedIssueTarget(booking.room_id ? `room_${booking.room_id}` : '');
    setIssueDescription('');
    setIssueStatusMsg({ type: '', text: '' });
  };

  const resetReport = () => {
    setSelectedIssueTarget('');
    setIssueDescription('');
    setIssueStatusMsg({ type: '', text: '' });
  };

  const submitIssue = async () => {
    if (issueSubmitting) return;
    if (!selectedIssueTarget) {
      setIssueStatusMsg({ type: 'error', text: '請選擇要回報的場地或空間' });
      return;
    }
    if (!issueDescription.trim()) {
      setIssueStatusMsg({ type: 'error', text: '請填寫問題描述' });
      return;
    }

    let finalRoomId: number;
    let finalDescription = issueDescription.trim();

    if (selectedIssueTarget && selectedIssueTarget.startsWith('room_')) {
      finalRoomId = Number(selectedIssueTarget.split('_')[1]);
    } else if (selectedIssueTarget && selectedIssueTarget.startsWith('ps_')) {
      const parts = selectedIssueTarget.split('_');
      finalRoomId = Number(parts[1]);
      const spaceName = parts.slice(2).join('_');
      finalDescription = `[公共空間 - ${spaceName}] ${finalDescription}`;
    } else {
      setIssueStatusMsg({ type: 'error', text: '無效的選擇標的' });
      return;
    }

    setIssueSubmitting(true);
    setIssueStatusMsg({ type: '', text: '' });
    try {
      const res = await apiCreateIssue(getToken(), finalRoomId, finalDescription);
      if (res.ok) {
        setIssueStatusMsg({ type: 'success', text: '回報成功！感謝您的協助。' });
        fetchUserIssues();
        setReportingBooking(null);
        onSuccess();
      } else {
        const err = await res.json();
        setIssueStatusMsg({ type: 'error', text: err.error || '回報失敗，請稍後再試' });
      }
    } catch {
      setIssueStatusMsg({ type: 'error', text: '網路錯誤，請稍後再試' });
    } finally {
      setIssueSubmitting(false);
    }
  };

  return {
    selectedIssueTarget, setSelectedIssueTarget,
    reportingBooking, setReportingBooking,
    userIssues,
    issueDescription, setIssueDescription,
    issueSubmitting,
    issueStatusMsg, setIssueStatusMsg,
    fetchUserIssues,
    getSelectableItems,
    startReporting,
    resetReport,
    submitIssue,
  };
}

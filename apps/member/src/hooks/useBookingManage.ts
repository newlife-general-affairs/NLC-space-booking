import { useState } from 'react';
import { apiCancelBooking, apiUpdateOwnBooking } from '@church/shared/api';

export interface BookingEditInput {
  date: string;
  startTime: string;
  endTime: string;
  roomId: number;
  attendanceCount: number;
  purpose: string;
}

export interface ManageResult {
  ok: boolean;
  message: string;
}

interface UseBookingManageOptions {
  getToken: () => string;
  /** 修改或取消成功後呼叫（重新載入紀錄、顯示提示） */
  onChanged: (message: string) => void;
}

/** 借用紀錄上的「修改預約」「取消預約」 */
export function useBookingManage({ getToken, onChanged }: UseBookingManageOptions) {
  const [busy, setBusy] = useState(false);

  const run = async (request: () => Promise<Response>, successFallback: string, errorFallback: string): Promise<ManageResult> => {
    setBusy(true);
    try {
      const res = await request();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: data.error || errorFallback };
      const message = data.message || successFallback;
      onChanged(message);
      return { ok: true, message };
    } catch {
      return { ok: false, message: '網路錯誤，請檢查連線後再試' };
    } finally {
      setBusy(false);
    }
  };

  const updateBooking = (id: number, input: BookingEditInput) =>
    run(() => apiUpdateOwnBooking(getToken(), id, input), '預約已修改', '修改預約失敗，請稍後再試');

  const cancelBooking = (id: number) =>
    run(() => apiCancelBooking(getToken(), id), '預約已取消', '取消預約失敗，請稍後再試');

  return { busy, updateBooking, cancelBooking };
}

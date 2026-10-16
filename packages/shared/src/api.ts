import type { TuyaCommandValue, UserProfile } from './types';
// ============================================================
// api.ts — 集中管理所有後端 API 呼叫
// 讓元件只負責 UI，不直接呼叫 fetch
// ============================================================

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const jsonHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

// ── 公告 ──────────────────────────────────────────────────────

export const apiFetchAnnouncements = () =>
  fetch('/api/announcements').then(r => r.json());

export const apiCreateAnnouncement = (token: string, title: string, content: string) =>
  fetch('/api/announcements', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ title, content }),
  });

export const apiUpdateAnnouncement = (token: string, id: number, title: string, content: string) =>
  fetch(`/api/announcements/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ title, content }),
  });

export const apiDeleteAnnouncement = (token: string, id: number) =>
  fetch(`/api/announcements/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

// ── 場地 ──────────────────────────────────────────────────────

export const apiFetchRooms = (branch?: string) =>
  fetch(`/api/rooms${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`).then(r => r.json());

export const apiCreateRoom = (token: string, data: object) =>
  fetch('/api/rooms', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

export const apiUpdateRoom = (token: string, id: number, data: object) =>
  fetch(`/api/rooms/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

export const apiDeleteRoom = (token: string, id: number) =>
  fetch(`/api/rooms/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

export const apiBatchDeleteRooms = (token: string, ids: number[]) =>
  fetch('/api/rooms/batch-delete', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ ids }),
  });

// ── 公共空間 ──────────────────────────────────────────────────

export const apiFetchPublicSpaces = (branch?: string) =>
  fetch(`/api/public-spaces${branch ? `?branch=${encodeURIComponent(branch)}` : ''}`).then(r => r.json());

export const apiCreatePublicSpace = (token: string, data: object) =>
  fetch('/api/public-spaces', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

export const apiUpdatePublicSpace = (token: string, id: number, data: object) =>
  fetch(`/api/public-spaces/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

export const apiDeletePublicSpace = (token: string, id: number) =>
  fetch(`/api/public-spaces/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

// ── 預約 ──────────────────────────────────────────────────────

export const apiFetchBookings = (token: string, branch: string) =>
  fetch(`/api/bookings?branch=${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  }).then(r => r.json());

export const apiCreateBooking = (token: string, data: object) =>
  fetch('/api/bookings', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

/** 使用者編輯自己的預約（日期、時段、場地、人數、用途） */
export const apiUpdateOwnBooking = (token: string, id: number, data: {
  date: string;
  startTime: string;
  endTime: string;
  roomId: number;
  attendanceCount: number;
  purpose: string;
}) =>
  fetch(`/api/bookings/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

export const apiCancelBooking = (token: string, id: number) =>
  fetch(`/api/bookings/${id}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  });

export const apiDeleteBooking = (token: string, id: number) =>
  fetch(`/api/bookings/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

export const apiToggleReturn = (token: string, id: number, is_returned: boolean) =>
  fetch(`/api/bookings/${id}/return`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ is_returned }),
  });

export const apiSendPassword = (token: string, id: number) =>
  fetch(`/api/bookings/${id}/send-password`, {
    method: 'POST',
    headers: authHeaders(token),
  });

export const apiResendPasswordEmail = (token: string, id: number) =>
  fetch(`/api/bookings/${id}/resend-password-email`, {
    method: 'POST',
    headers: authHeaders(token),
  });

export const apiCompleteUsage = (token: string, id: number) =>
  fetch(`/api/bookings/${id}/complete-usage`, {
    method: 'PUT',
    headers: authHeaders(token),
  });

export const apiAssignCleaning = (token: string, id: number, cleaning_assignments: string) =>
  fetch(`/api/bookings/${id}/cleaning`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ cleaning_assignments }),
  });

export const apiCheckAvailability = (date: string, start: string, end: string) =>
  fetch(`/api/bookings/check-all?date=${date}&start=${start}&end=${end}`).then(r =>
    r.ok ? r.json() as Promise<number[]> : [] as number[]
  );

// ── 個人資料 ──────────────────────────────────────────────────

export const apiFetchProfile = async (token: string): Promise<UserProfile> => {
  const response = await fetch('/api/profile', { headers: authHeaders(token) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Profile API returned status ' + response.status);
  }
  return response.json();
};

export const apiFetchProfileMe = (token: string) =>
  fetch('/api/profiles/me', { headers: authHeaders(token) });

export const apiSaveProfile = (token: string, data: { fullName: string; phone: string; pastoralZone: string }) =>
  fetch('/api/profile', {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

// ── 問題回報 ──────────────────────────────────────────────────

export const apiFetchMyIssues = (token: string) =>
  fetch('/api/my-issues', { headers: authHeaders(token) }).then(r => r.json());

export const apiFetchAdminIssues = (token: string, branch: string) =>
  fetch(`/api/issues?branch=${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  }).then(r => r.json());

export const apiCreateIssue = (token: string, room_id: number, description: string) =>
  fetch('/api/issues', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ room_id, description }),
  });

export const apiUpdateIssueStatus = (token: string, id: number, status: string) =>
  fetch(`/api/issues/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ status }),
  });

export const apiDeleteIssue = (token: string, id: number) =>
  fetch(`/api/issues/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

// ── 管理端預約 ────────────────────────────────────────────────

export const apiFetchAdminBookings = (token: string, branch: string) =>
  fetch(`/api/admin/bookings?branch=${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  }).then(r => r.json());

export const apiUpdateBookingStatus = (token: string, id: number, status: string, rejection_reason?: string) =>
  fetch(`/api/admin/bookings/${id}/status`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ status, ...(rejection_reason ? { rejection_reason } : {}) }),
  });

export const apiAssignBookingRoom = (token: string, id: number, room_id: number) =>
  fetch(`/api/admin/bookings/${id}/room`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ room_id }),
  });

export const apiUpdateBooking = (token: string, id: number, data: object) =>
  fetch(`/api/admin/bookings/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

// ── 表單自動匯入紀錄 ──────────────────────────────────────────

export const apiFetchFormIntake = (token: string, status: 'unresolved' | 'all' = 'unresolved') =>
  fetch(`/api/admin/form-intake?status=${status}`, {
    headers: authHeaders(token),
  }).then(r => r.json());

export const apiResolveFormIntake = (token: string, id: number, resolved: boolean) =>
  fetch(`/api/admin/form-intake/${id}/resolve`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ resolved }),
  });

// ── Tuya ──────────────────────────────────────────────────────
 
export const apiTestTuyaConnection = (token: string) =>
  fetch('/api/tuya/test-connection', { headers: authHeaders(token) }).then(r => r.json());

export const apiFetchTuyaDevicesStatus = (token: string, branch: string) =>
  fetch(`/api/tuya/devices-status?branch=${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  }).then(r => r.json());

export const apiControlTuyaDevice = (token: string, deviceId: string, commands: Array<{ code: string; value: TuyaCommandValue }>) =>
  fetch('/api/tuya/control', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ deviceId, commands }),
  }).then(r => r.json());

// ── 每週看板 ──────────────────────────────────────────────────

export const apiFetchWeeklyBookings = (start: string, end: string, branch?: string, token?: string) => {
  const params = new URLSearchParams({ start, end });
  if (branch) params.set('branch', branch);
  return fetch(`/api/bookings/weekly?${params}`, {
    headers: token ? authHeaders(token) : {},
  }).then(r => r.json());
};

export const apiFetchSpecialBookings = (branch?: string, token?: string) => {
  const params = new URLSearchParams();
  if (branch) params.set('branch', branch);
  return fetch(`/api/bookings/special?${params}`, {
    headers: token ? authHeaders(token) : {},
  }).then(r => r.json());
};

// ── 使用者角色管理 (system_admin) ────────────────────────────

export const apiFetchUserRoles = (token: string) =>
  fetch('/api/users/roles', { headers: authHeaders(token) }).then(r => r.json());

export const apiUpdateUserRole = (token: string, id: string, data: { role?: string; branch?: string | null }) =>
  fetch(`/api/users/roles/${id}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });

// ── 地圖與即時狀態 ────────────────────────────────────────────

export const apiFetchBookingsByDate = (date: string, branch: string) =>
  fetch(`/api/bookings/by-date?date=${encodeURIComponent(date)}&branch=${encodeURIComponent(branch)}`).then(r => r.json());

export const apiFetchActiveBookingsNow = (branch: string) =>
  fetch(`/api/bookings/now?branch=${encodeURIComponent(branch)}`).then(r => r.json());

export const apiUpdateRoomPolygon = (token: string, id: number, polygonPoints: string) =>
  fetch(`/api/rooms/${id}/polygon`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ polygon_points: polygonPoints }),
  });

// ── 違規紀錄管理 ──────────────────────────────────────────────

export const apiFetchViolations = (token: string, branch: string) =>
  fetch(`/api/admin/violations?branch=${encodeURIComponent(branch)}`, { headers: authHeaders(token) }).then(r => r.json());

export const apiAddViolation = (token: string, booking_id: number, reason: string) =>
  fetch('/api/admin/violations', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ booking_id, reason }),
  });

export const apiUpdateViolation = (token: string, booking_id: number, reason: string) =>
  fetch(`/api/admin/violations/${booking_id}`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ reason }),
  });

export const apiDeleteViolation = (token: string, booking_id: number) =>
  fetch(`/api/admin/violations/${booking_id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

export const apiFetchPastorStatus = (token: string, pastoralZone: string, date: string) =>
  fetch(`/api/bookings/pastor-status?pastoralZone=${encodeURIComponent(pastoralZone)}&date=${encodeURIComponent(date)}`, {
    headers: authHeaders(token),
  }).then(r => r.json());

export const apiFetchDisqualifiedZones = (token: string, date: string, branch?: string | null) => {
  const url = `/api/bookings/disqualified-zones?date=${encodeURIComponent(date)}` + 
    (branch ? `&branch=${encodeURIComponent(branch)}` : '');
  return fetch(url, {
    headers: authHeaders(token),
  }).then(r => r.json());
};


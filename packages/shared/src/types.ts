// ============================================================
// types.ts — 集中管理所有共用 TypeScript 型別定義
// ============================================================

export interface Room {
  id: number;
  name: string;
  capacity: number;
  description: string;
  image_url: string;
  branch: string;
  tuya_device_id?: string | null;
  tuya_light_id?: string | null;
  tuya_ac_id?: string | null;
  parent_room_id?: number | null;
  polygon_points?: string | null;
}

export interface PublicSpace {
  id: number;
  name: string;
  branch: string;
  category: string;
  sort_order?: number;
  tuya_light_id?: string | null;
  tuya_device_id?: string | null;
  tuya_ac_id?: string | null;
}

export interface Booking {
  id: number;
  room_id: number;
  user_email: string;
  full_name: string;
  phone: string;
  pastoral_zone: string;
  purpose: string;
  booking_type: string;
  attendance_count: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  is_returned: boolean;
  created_at: string;
  room_name: string;
  access_code?: string;
  status: string;
  cleaning_assignments?: string;
  tuya_device_id?: string | null;
  tuya_password_id?: string | null;
  rooms?: { name: string; branch: string; tuya_device_id?: string | null } | null;
  violation?: { reason: string } | null;
  rejection_reason?: string | null;
  cleaning_status?: string | null;
  room_capacity?: number;
  branch?: string;
  updated_at?: string;
}

export interface FormIntakeNeedsReviewItem {
  bookingId?: number;
  reason?: string;
  raw?: string;
}

export interface FormIntakeSkippedItem {
  reason?: string;
  raw?: string;
}

export interface FormIntakeLog {
  id: number;
  form_response_id: string;
  received_at: string;
  borrower_name?: string | null;
  pastoral_zone?: string | null;
  phone?: string | null;
  form_type?: string | null;
  raw_payload: unknown;
  created_booking_ids: number[];
  needs_review: FormIntakeNeedsReviewItem[];
  skipped: FormIntakeSkippedItem[];
  error?: string | null;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

export interface Issue {
  id: number;
  room_id: number;
  description: string;
  status: string;
  reported_by: string;
  created_at: string;
  rooms?: { name: string; branch: string } | null;
  user_profiles?: { full_name?: string } | null;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export interface BookingSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface BookingFormState {
  slots: BookingSlot[];
  fullName: string;
  phone: string;
  pastoralZone: string;
  purpose: string;
  bookingType: string;
  attendanceCount: number;
}

export type StatusMsg = { type: string; text: string };

export type ActiveTab =
  | 'home'
  | 'booking'
  | 'records'
  | 'admin'
  | 'weekly'
  | 'special-events'
  | 'system'
  | 'map'
  | 'branches'
  | 'issues'
  | 'announcements';
export interface UserProfile {
  full_name?: string;
  phone?: string;
  pastoral_zone?: string;
}

export interface DisqualifiedZone {
  pastoral_zone?: string;
  reason?: string;
  points?: number;
  count?: number;
  pastoralZone: string;
  reasonMonth: string;
  suspendedMonth: string;
  totalPoints?: number;
  totalCount?: number;
  branch?: string;
}

export interface ViolationRecord {
  id: number;
  booking_id: number;
  room_name?: string;
  full_name?: string;
  phone?: string;
  user_email?: string;
  pastoral_zone?: string;
  reason: string;
  points: number;
  violation_type?: string;
  is_cancelled?: boolean;
  created_at?: string;
  booking_date?: string;
  start_time?: string;
  end_time?: string;
  purpose?: string;
  is_manual?: boolean;
}

export interface ViolationSummaryItem {
  reason?: string;
  points: number;
  created_at?: string;
  booking_date?: string;
  id: number;
  is_cancelled?: boolean;
  start_time?: string;
  end_time?: string;
  room_name?: string;
  branch?: string;
  full_name?: string;
  phone?: string;
  violation_type?: string;
  pastoral_zone?: string;
}

export interface ViolationSummary {
  violations: ViolationSummaryItem[];
  totalPoints: number;
  totalCount: number;
  suspended?: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  branch?: string | null;
}

export type TuyaCommandValue = string | number | boolean;

export interface TuyaDeviceState {
  online: boolean;
  status: Record<string, TuyaCommandValue | undefined> & {
    updating?: boolean;
    switch?: boolean;
    temp_set?: number;
  };
}

export interface TuyaTestResult {
  success: boolean;
  error?: string;
  message?: string;
  tokenPreview?: string;
}

export interface BookingCreatePayload {
  slots: BookingSlot[];
  fullName: string;
  phone: string;
  pastoralZone: string;
  bookingType: string;
  attendanceCount: number;
  roomId?: number;
  purpose?: string;
  rooms?: Array<{ roomId: number; purpose: string }>;
}


import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  Users,
  Wrench,
} from 'lucide-react';

export type ConsoleRole = 'system_admin' | 'admin' | 'inspector';

export type PageId =
  | 'overview'
  | 'bookings-review'
  | 'bookings-form-intake'
  | 'schedule-week'
  | 'schedule-events'
  | 'schedule-map'
  | 'onsite-cleaning'
  | 'onsite-locks'
  | 'onsite-issues'
  | 'members-violations'
  | 'members-announcements'
  | 'settings-rooms'
  | 'settings-public-spaces'
  | 'settings-devices'
  | 'settings-users';

export type SectionId = 'overview' | 'bookings' | 'schedule' | 'onsite' | 'members' | 'settings';

export interface NavPage {
  id: PageId;
  label: string;
  roles: ConsoleRole[];
  /** 內容很寬（週看板、平面地圖），進入時自動收合側邊欄 */
  wide?: boolean;
}

export interface NavSection {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  pages: NavPage[];
}

const STAFF: ConsoleRole[] = ['system_admin', 'admin'];
const ALL: ConsoleRole[] = ['system_admin', 'admin', 'inspector'];

// 唯一的導覽與權限設定：側邊欄、手機導覽、頁面防護都從這裡讀取
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: '總覽',
    icon: LayoutDashboard,
    pages: [{ id: 'overview', label: '今日總覽', roles: ALL }],
  },
  {
    id: 'bookings',
    label: '預約',
    icon: ClipboardCheck,
    pages: [
      { id: 'bookings-review', label: '預約審核', roles: STAFF },
      { id: 'bookings-form-intake', label: '表單匯入紀錄', roles: STAFF },
    ],
  },
  {
    id: 'schedule',
    label: '檔期',
    icon: CalendarDays,
    pages: [
      { id: 'schedule-week', label: '週看板', roles: STAFF, wide: true },
      { id: 'schedule-events', label: '婚禮與重要活動', roles: STAFF },
      { id: 'schedule-map', label: '平面地圖', roles: STAFF, wide: true },
    ],
  },
  {
    id: 'onsite',
    label: '現場',
    icon: Wrench,
    pages: [
      { id: 'onsite-cleaning', label: '清潔稽核', roles: ALL },
      { id: 'onsite-locks', label: '門鎖密碼', roles: STAFF },
      { id: 'onsite-issues', label: '故障回報', roles: ALL },
    ],
  },
  {
    id: 'members',
    label: '會員',
    icon: Users,
    pages: [
      { id: 'members-violations', label: '違規記點', roles: STAFF },
      { id: 'members-announcements', label: '公告', roles: STAFF },
    ],
  },
  {
    id: 'settings',
    label: '設定',
    icon: Settings,
    pages: [
      { id: 'settings-rooms', label: '場地配置', roles: STAFF },
      { id: 'settings-public-spaces', label: '公共空間', roles: STAFF },
      { id: 'settings-devices', label: '智慧裝置', roles: STAFF },
      { id: 'settings-users', label: '使用者角色', roles: ['system_admin'] },
    ],
  },
];

/** 手機底部導覽直接顯示的區塊，其餘放進「更多」 */
export const MOBILE_PRIMARY_SECTIONS: SectionId[] = ['overview', 'bookings', 'schedule', 'onsite'];

export const ROLE_LABEL: Record<string, string> = {
  system_admin: '系統管理員',
  admin: '據點管理員',
  inspector: '查察員',
  user: '一般會眾',
};

export function canAccess(page: NavPage, role: string | null): boolean {
  return !!role && (page.roles as string[]).includes(role);
}

/** 依角色過濾後的導覽（沒有任何可用頁面的區塊會被移除） */
export function getVisibleSections(role: string | null): NavSection[] {
  return NAV_SECTIONS
    .map(section => ({ ...section, pages: section.pages.filter(p => canAccess(p, role)) }))
    .filter(section => section.pages.length > 0);
}

export function findPage(id: string): { section: NavSection; page: NavPage } | null {
  for (const section of NAV_SECTIONS) {
    const page = section.pages.find(p => p.id === id);
    if (page) return { section, page };
  }
  return null;
}

/** 從網址 hash 還原頁面；無效或無權限時回到總覽 */
export function resolveInitialPage(role: string | null): PageId {
  const id = window.location.hash.replace(/^#/, '');
  const found = findPage(id);
  return found && canAccess(found.page, role) ? found.page.id : 'overview';
}

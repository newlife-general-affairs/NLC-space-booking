import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from './HomePage';
import type { User } from '@supabase/supabase-js';

// 宣告全域測試變數以解決 IDE 的 TypeScript 解析器警告
declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: any;
declare const jest: any;

const mockUser = {
  id: 'user-123',
  email: 'heyiyu@gmail.com',
} as User & { email: string };

const mockUserProfile = {
  full_name: '何翊宇',
  pastoral_zone: '青少牧區',
  phone: '0912345678'
};

const mockAnnouncements = [
  {
    id: 1,
    title: '重要公告一',
    content: '這是公告內容',
    is_active: true,
    created_at: '2026-07-15T00:00:00Z',
    created_by: 'Admin'
  }
];

describe('HomePage Accessibility and Layout Tests', () => {
  const mockSelectBranch = jest.fn();
  const mockTabChange = jest.fn();

  test('狀態卡片應具備 role="status" 與 aria-live="polite" 以符合 WCAG 無障礙宣告', () => {
    render(
      <HomePage
        currentBranch="仁愛堂"
        role="user"
        user={mockUser}
        userProfile={mockUserProfile}
        announcements={mockAnnouncements}
        disqualifiedZones={[]}
        isAdmin={false}
        onSelectBranch={mockSelectBranch}
        onTabChange={mockTabChange}
      />
    );

    // 取得一般使用者正常的狀態卡片
    const statusCard = screen.getByTestId('status-card-user-normal');
    expect(statusCard).toBeInTheDocument();
    
    // 驗證 WCAG 輔助屬性
    expect(statusCard).toHaveAttribute('role', 'status');
    expect(statusCard).toHaveAttribute('aria-live', 'polite');
  });

  test('同工管理員視角下的狀態卡片也應具備 WCAG 屬性', () => {
    render(
      <HomePage
        currentBranch="仁愛堂"
        role="admin"
        user={mockUser}
        userProfile={mockUserProfile}
        announcements={mockAnnouncements}
        disqualifiedZones={[]}
        isAdmin={true}
        onSelectBranch={mockSelectBranch}
        onTabChange={mockTabChange}
      />
    );

    // 取得管理員視角的狀態卡片
    const statusCard = screen.getByTestId('status-card-normal');
    expect(statusCard).toBeInTheDocument();
    
    // 驗證 WCAG 輔助屬性
    expect(statusCard).toHaveAttribute('role', 'status');
    expect(statusCard).toHaveAttribute('aria-live', 'polite');
  });

  test('問候區與下拉據點切換選單應正確載入並顯示使用者姓名', () => {
    render(
      <HomePage
        currentBranch="仁愛堂"
        role="user"
        user={mockUser}
        userProfile={mockUserProfile}
        announcements={mockAnnouncements}
        onSelectBranch={mockSelectBranch}
        onTabChange={mockTabChange}
      />
    );

    // 驗證使用者名稱是否出現在畫面上
    expect(screen.getByText('何翊宇')).toBeInTheDocument();
    
    // 驗證無障礙環境下據點下拉選單正常載入
    const selectEl = screen.getByRole('combobox');
    expect(selectEl).toBeInTheDocument();
    expect(selectEl).toHaveValue('仁愛堂');
  });
});

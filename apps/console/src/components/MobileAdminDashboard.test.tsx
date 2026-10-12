import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MobileAdminDashboard from './MobileAdminDashboard';

// 宣告全域測試變數以解決 IDE 的 TypeScript 解析器警告
declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: any;

describe('MobileAdminDashboard 互動與功能測試', () => {
  const mockRooms = ['大禮堂', '第一教室', '副堂'];
  
  test('應成功渲染主控台且預設不顯示篩選抽屜與匯入抽屜', () => {
    render(<MobileAdminDashboard roomsList={mockRooms} />);
    
    // 驗證標題渲染
    expect(screen.getByText('預約與空間管理')).toBeInTheDocument();
    expect(screen.getByText('同工管理')).toBeInTheDocument();
    
    // 預設抽屜不應該存在於 DOM 中
    expect(screen.queryByTestId('filter-drawer')).not.toBeInTheDocument();
    expect(screen.queryByText('Google 試算表排程匯入')).not.toBeInTheDocument();
  });

  test('點擊篩選按鈕應彈出篩選面板，且點擊背景遮罩應能關閉面板', () => {
    render(<MobileAdminDashboard roomsList={mockRooms} />);
    
    // 1. 取得篩選按鈕
    const filterBtn = screen.getByTestId('filter-button');
    expect(filterBtn).toBeInTheDocument();

    // 2. 模擬點擊篩選按鈕
    fireEvent.click(filterBtn);

    // 3. 驗證篩選抽屜出現在 DOM 中
    const filterDrawer = screen.getByTestId('filter-drawer');
    expect(filterDrawer).toBeInTheDocument();
    expect(screen.getByText('篩選與排序條件')).toBeInTheDocument();
    expect(screen.getByText('場地空間')).toBeInTheDocument();

    // 4. 驗證空間選單內包含我們傳入的 Mock 空間項目
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('大禮堂')).toBeInTheDocument();
    expect(screen.getByText('第一教室')).toBeInTheDocument();

    // 5. 點擊背景遮罩以關閉抽屜 (在 filter-drawer 內的第一個子元素為背景 click handler)
    const backdrop = filterDrawer.querySelector('.absolute.inset-0');
    expect(backdrop).toBeInTheDocument();
    
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    // 6. 驗證抽屜已成功自 DOM 中移除
    expect(screen.queryByTestId('filter-drawer')).not.toBeInTheDocument();
  });

  test('點擊匯入排程按鈕應開啟匯入抽屜，且輸入欄位應具備格式與安全防禦驗證', async () => {
    render(<MobileAdminDashboard roomsList={mockRooms} />);

    // 1. 點擊頂部「匯入排程」按鈕
    const importBtn = screen.getByRole('button', { name: /匯入排程/ });
    expect(importBtn).toBeInTheDocument();
    fireEvent.click(importBtn);

    // 2. 驗證匯入抽屜彈出
    expect(screen.getByText('Google 試算表排程匯入')).toBeInTheDocument();

    // 3. 獲取輸入框與提交按鈕
    const inputEl = screen.getByPlaceholderText(/https:\/\/docs\.google\.com/) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: '立即分析並匯入' });
    
    expect(inputEl).toBeInTheDocument();
    expect(submitBtn).toBeInTheDocument();

    // 4. 測試安全防禦 1：輸入為空時提交
    fireEvent.change(inputEl, { target: { value: '   ' } });
    fireEvent.click(submitBtn);
    expect(screen.getByText('請輸入連結網址')).toBeInTheDocument();

    // 5. 測試安全防禦 2：輸入惡意 XSS 腳本注入時提交
    fireEvent.change(inputEl, { target: { value: '<script>alert("xss")</script>' } });
    fireEvent.click(submitBtn);
    expect(screen.getByText('輸入包含不安全的安全字元，請重新輸入')).toBeInTheDocument();

    // 6. 測試安全防禦 3：輸入非法 Google Sheets 連結
    fireEvent.change(inputEl, { target: { value: 'https://malicious-site.com/hack' } });
    fireEvent.click(submitBtn);
    expect(screen.getByText('無效的連結！請提供合法的 Google 試算表共用網址')).toBeInTheDocument();

    // 7. 測試輸入正確連結
    fireEvent.change(inputEl, { target: { value: 'https://docs.google.com/spreadsheets/d/1abc123XYZ/edit?usp=sharing' } });
    fireEvent.click(submitBtn);
    
    // 應無錯誤提示
    expect(screen.queryByText('無效的連結！請提供合法的 Google 試算表共用網址')).not.toBeInTheDocument();
  });
});

# 空間租借系統 — 專案程式架構文件 (Project Architecture)

本專案是一個整合 **教會場地預約**、**智慧電子門鎖 (涂鴉智能 Tuya)**、**打掃歸還稽核** 與 **違規停權機制** 的全棧 Web 應用程式。採用前後端分離架構，前端基於 React + TypeScript，後端基於 Node.js + Express，資料庫使用 Supabase。

> **2026-09 架構調整（P1）**：原本單一的 `frontend/` SPA 已拆成 **使用者端**（`apps/member`）與 **後台控制台**（`apps/console`）兩個獨立前端，共用邏輯集中在 `packages/shared`（`@church/shared`），以 npm workspaces 管理。詳見 [`docs/前後台拆分與使用者端PWA重構-設計報告.md`](docs/前後台拆分與使用者端PWA重構-設計報告.md)。

---

## 📂 專案目錄結構 (Directory Structure)

```text
space-booking-system/
├── backend/                       # 後端伺服器 (Node.js + Express)
│   ├── blocks/                    # 積木架構模組 (Lego Block Pattern)
│   │   ├── BaseBlock.js           # 抽象基底積木類別
│   │   ├── BlockPipeline.js       # 積木管線組裝器
│   │   ├── BookingError.js        # 積木業務自訂錯誤
│   │   └── booking/               # 預約專用獨立小積木
│   │       ├── InputValidationBlock.js  # 驗證與清理欄位輸入
│   │       ├── TimingPolicyBlock.js     # 限制借用時段與前置天數
│   │       ├── SuspensionCheckBlock.js  # 檢查牧區停權狀態
│   │       ├── OverlapCheckBlock.js     # 父子空間重疊與重複預約校驗
│   │       ├── DbInsertBlock.js         # 批次寫入資料庫
│   │       └── EmailNotifyBlock.js      # 非同步發送確認信
│   ├── routes/                    # 路由控制器 (Express Routers)
│   │   ├── bookings.js            # 預約核心端點 (已整合 Lego 管線)
│   │   ├── admin.js               # 管理端點 (審核、匯入名單)
│   │   ├── rooms.js               # 場地管理端點
│   │   ├── tuya.js                # 涂鴉門鎖同步端點
│   │   ├── announcements.js       # 公告發佈管理
│   │   ├── issues.js              # 問題回報處理
│   │   └── users.js               # 使用者設定檔
│   ├── tests/                     # 後端 Jest 單元測試
│   │   ├── BaseBlock.test.js
│   │   ├── BlockPipeline.test.js
│   │   ├── InputValidationBlock.test.js
│   │   └── ... (其餘小積木之獨立測試)
│   ├── database.js                # Supabase 客戶端初始化
│   ├── mailService.js             # Nodemailer 郵件服務 (發送確認、密碼)
│   ├── tuyaClient.js              # 涂鴉門鎖雲端 API 介面 (Passcode 同步與刪除)
│   ├── validators.js              # 全域輸入清理與白名單驗證
│   ├── violationsStore.js         # 違規點數計算與動態超時判定
│   ├── package.json               # 後端依賴與測試腳本
│   └── index.js                   # 伺服器啟動入口
│
├── packages/
│   └── shared/                    # @church/shared — 兩個前端共用（無 UI 主題）
│       └── src/
│           ├── types.ts           #  共用 TypeScript 型別
│           ├── api.ts             #  所有後端 API 呼叫封裝
│           ├── supabase.ts        #  Supabase client 初始化
│           ├── constants.ts       #  BRANCHES 等共用常數
│           ├── auth/             #  AuthProvider / useAuth / AuthContext
│           ├── domain/          #  roomGrid.ts、bookingConflicts.ts（純邏輯）
│           └── components/     #  Login、WeeklyBulletin、SpecialEventsPage（雙端共用視圖）
│
├── apps/
│   ├── member/                    # 使用者端 (React + TS + Vite，PWA；port 5173)
│   │   ├── src/
│   │   │   ├── App.tsx           #  登入 → 選據點 → 首頁 / 預約 / 檔期 / 紀錄
│   │   │   ├── components/       #  AppHeader、CleanupModal、ProfileModal、StatusToast
│   │   │   ├── hooks/           #  useBooking / useProfile / useIssueReport / useOnlineStatus
│   │   │   ├── pages/          #  HomePage、BookingPage、RecordsPage、IssueReportPage…
│   │   │   ├── repositories/  #  IndexedDB（預約草稿）
│   │   │   └── services/     #  BookingDraftService、PwaService
│   │   ├── public/               #  manifest.webmanifest、sw.js、sw/
│   │   └── vite.config.mjs
│   │
│   └── console/                   # 後台控制台 (React + TS + Vite，桌機 Web；port 5174)
│       ├── src/
│       │   ├── App.tsx           #  登入 → 選據點 → AdminPanel / SuperAdminPanel
│       │   ├── AdminPanel.tsx    #  後台側邊欄 + 分頁容器
│       │   ├── SuperAdminPanel.tsx  # 全系統帳號權限
│       │   ├── FloorMap.tsx      #  平面地圖與多邊形編輯
│       │   ├── components/       #  AdminInspectionModal、AssignCleaningModal、
│       │   │                    #    MobileAdminDashboard（P3 待汰換）…
│       │   └── pages/admin/      #  BookingsTab、RoomsTab、TuyaTab、ViolationsTab…
│       └── vite.config.mjs
│
├── api/index.js                   # 前台 Vercel 專案的 API 入口（載入 backend/index.js）
├── vercel.json                    # 前台 Vercel 專案：member + API（後台見 apps/console/vercel.json）
└── package.json                   # 根目錄 npm workspaces（packages/*、apps/*）
```

---

## ⚙️ 後端核心架構 (Backend Lego Block Pipeline)

為了保證後端業務邏輯的擴充性，**預約新增路由 (`POST /api/bookings`)** 採用 **【積木架構法 (Modular Lego Architecture)】** 進行徹底解耦。

### 1. 統一管線模式
當預約請求送入時，由 `BlockPipeline` 實例載入 6 個獨立功能積木，並以一組共享的 `context` 依序串聯執行：
```javascript
// backend/routes/bookings.js
router.post('/', authMiddleware, async (req, res) => {
  const context = { reqBody: req.body, user: req.user };
  const pipeline = new BlockPipeline();
  
  pipeline
    .use(new InputValidationBlock())  // 1. 欄位清理與 Zod 驗證
    .use(new TimingPolicyBlock())     // 2. 時段天數原則審查
    .use(new SuspensionCheckBlock())  // 3. 停權資格查核
    .use(new OverlapCheckBlock())     // 4. 時段衝突判定
    .use(new DbInsertBlock())         // 5. 資料寫入
    .use(new EmailNotifyBlock());     // 6. 電子郵件確認發送

  try {
    await pipeline.run(context);
    res.status(context.responseStatus || 200).json(context.responseData);
  } catch (error) {
    if (error instanceof BookingError) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: '建立預約失敗，請稍後再試' });
  }
});
```

---

## 🖥️ 前端視圖與狀態控制 (Frontend Layout)

前端架構為一個典型的單頁應用程式 (SPA)，透過 `AuthContext` 攔截 JWT 進行身份宣告，並提供一般使用者與管理員雙重介面：

1. **使用者端 (HomePage / BookingPage)**：
   - 瀏覽場地時段與狀態。
   - 提供直覺的時段格子（以 15 分鐘為單位）勾選預約。
   - 透過 `CleanupModal` 回報結束時的場地清理狀況。
2. **管理端 (AdminPanel / SuperAdminPanel)**：
   - **審核面板 (`BookingsTab`)**：一鍵批准、核發門鎖隨機密碼、或者退回預約（附帶原因）。
   - **違規管理 (`ViolationsTab`)**：顯示由系統自動記錄（如退改時限超期、超時未歸還）與管理員手動扣點的清單，並依此動態禁止特定牧區於次月的預約資格。
   - **裝置同步 (`TuyaTab`)**：呈現涂鴉門鎖與本系統資料庫密碼同步的進度，提供手動重試或刪除過期密碼的通道。

---

## 🗄️ 資料庫實體關聯 (Supabase DB Schema)

專案主要依賴以下 Supabase 實體資料表：

- **`rooms`**：存儲所有場地資訊。
  - `id` (主鍵)、`name` (場地名稱)、`branch` (仁愛堂/士林堂/新莊/大福/全)、`parent_room_id` (關聯父空間，若父空間被借用，子空間自動衝突)、`tuya_device_id` (連動的涂鴉門鎖實體 ID)。
- **`bookings`**：場地借用主表。
  - `id` (主鍵)、`room_id` (外鍵關聯 `rooms`)、`booking_date` (預約日期)、`start_time`/`end_time` (預約區間)、`status` (pending/approved/rejected)、`access_code` (核發的門鎖密碼)、`tuya_password_id` (涂鴉端建立的密碼 ID)。
- **`violations`**：牧區扣分明細表。
  - `id` (主鍵)、`booking_id` (關聯的借用單)、`pastoral_zone` (被扣分牧區)、`points` (扣分點數，取消限期 1~4 點，未歸還 1 點)、`violation_type` (cancel/change/no_show/late_return/manual)。
- **`user_profiles`**：使用者擴充設定。
  - `id` (使用者 UUID)、`pastoral_zone` (所屬牧區)、`role` (user/admin/system_admin/inspector)。

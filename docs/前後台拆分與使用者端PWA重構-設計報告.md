# 前後台拆分 × 使用者端 PWA 重構 — 設計報告

> 目標讀者：本專案維護者 / 前端開發 / 設計
> 狀態：**P1 已完成（2026-09-11）** — §8 全數採用建議選項；P2/P3/P4 未動工
> 撰寫日期：2026-09-11
> 前置文件：[`PROJECT_ARCHITECTURE.md`](../PROJECT_ARCHITECTURE.md)、[`frontend/docs/PWA_ARCHITECTURE.md`](../frontend/docs/PWA_ARCHITECTURE.md)、[`衝突拖曳調整-設計報告.md`](衝突拖曳調整-設計報告.md)

---

## 0. 摘要（TL;DR）

目前**使用者端**與**後台控制台**擠在同一個 React SPA（[`frontend/`](../frontend)）裡，用 `role` / `adminMode` 分流。這造成三個問題：邏輯糾纏（[`App.tsx`](../frontend/src/App.tsx) 612 行同時處理會眾首頁、預約流程、管理主控台、系統帳戶管理）、**同一套視覺被迫服務兩種完全不同的使用情境**（手機深色殼 + 被 CSS 硬改成淺色的預約流程 + 用 Tailwind 色票 hack 強制淺色的後台），以及 PWA / Service Worker 的 scope 同時罩住兩邊。

**建議做法**：

1. **拆成兩個獨立前端 app、各自一個 origin**，用 npm workspaces 收在同一個 repo：
   - `apps/member` — 使用者端，**手機優先 PWA、仿生 App**，畫面全面重構。
   - `apps/console` — 後台控制台，**維持桌機 Web**，沿用現有功能、換掉色彩 hack。
   - `packages/shared` — 兩邊共用的型別、API client、Supabase 驗證、純領域邏輯。
2. `backend/` **不動**（只收緊 CORS）。
3. 分 4 階段：P1 純搬移（不改外觀）→ P2 使用者端 PWA 重構 → P3 後台整理 → P4 切換網域與汰換舊 Service Worker。

本報告只做設計，不含實作。

---

## 1. 現況與痛點

### 1.1 目前架構

```
space-booking-system/
├── backend/            Express API（/api/*）
├── frontend/           單一 Vite + React SPA
│   └── src/
│       ├── App.tsx            612 行：登入 → 選據點 → (會眾 | 管理員 | 系統管理員) 分流
│       ├── AdminPanel.tsx     575 行：後台側邊欄 + 13 個分頁 + 手機版 dashboard
│       ├── SuperAdminPanel.tsx 帳戶權限表（純桌機表格）
│       ├── components/MobileAdminDashboard.tsx  1045 行：後台的手機專用殼
│       ├── pages/             會眾頁：HomePage / BookingPage / RecordsPage …
│       └── pages/admin/       後台分頁：BookingsTab / RoomsTab / TuyaTab …
├── migration/
└── vercel.json         frontend/ 靜態 + backend/index.js，同一個部署
```

- 單一 Vite 專案、單一 `dist/`、單一 `manifest.webmanifest`、單一 `public/sw.js`。
- 驗證：Supabase Google OAuth，`redirectTo: window.location.origin`（[`AuthContext.tsx:73`](../frontend/src/AuthContext.tsx:73)）。角色由 `GET /api/profiles/me` 回傳（`user` / `admin` / `system_admin` / `inspector`）。
- 主題：`index.css` 定義一套深色 60-30-10（深海軍藍 + 琥珀金）。但：
  - [`tailwind.config.js:31-40`](../frontend/tailwind.config.js:31) 把 `indigo` / `violet` 整條色階**覆寫成琥珀色**，只為了讓沿用 indigo class 的舊頁面不要「互相打架」。
  - [`index.css:303-390`](../frontend/src/index.css:303) 用 `.booking-app` / `.admin-workspace` 把預約流程與後台在手機上**硬切回淺色**（`color-scheme: light`）。
  - [`index.css:240-255`](../frontend/src/index.css:240) 用選擇器把一堆 `text-white/20`、`text-slate-400`、`text-rose-500` 補救成合格對比。

### 1.2 具體痛點

| # | 痛點 | 佐證 |
|---|---|---|
| 1 | **一份程式碼、兩種心智模型**。改會眾首頁要繞過 `adminMode` / `isAdmin` 的條件渲染；改後台要處理它其實跑在深色殼裡。 | [`App.tsx:330-576`](../frontend/src/App.tsx:330)（`adminMode`、`AdminModeSelector`、底部 nav 依 `adminMode === 'booking'` 顯示） |
| 2 | **視覺系統自我矛盾**：深色 token + 覆寫 indigo + `.booking-app` 淺色 + `.admin-workspace` 淺色 + 對比補丁。新人無法從單一來源判斷「這頁該長怎樣」。 | `tailwind.config.js`、`index.css` |
| 3 | **後台被迫做手機版**：[`MobileAdminDashboard.tsx`](../frontend/src/components/MobileAdminDashboard.tsx) 1045 行，把 13 個分頁塞進手機橫向 pill；審核 / 拖曳看板 / Tuya 排程 / 平面地圖多邊形編輯在手機上本來就不該做（[`衝突拖曳調整-設計報告.md`](衝突拖曳調整-設計報告.md) §2 已明列「不做手機版拖曳」）。維護成本高、幾乎沒人用。 | `AdminPanel.tsx:240-335` |
| 4 | **PWA scope 罩到後台**：`sw.js` 註冊在 `/`，precache 的是同一個 app shell；後台頁面也走同一組導覽快取策略。Service Worker 的快取版本一動，兩邊使用者一起受影響。 | [`sw.js`](../frontend/public/sw.js)、[`sw/config.js`](../frontend/public/sw/config.js) |
| 5 | **使用者端不像 App**：頂部是網頁 header（[`AppHeader.tsx`](../frontend/src/components/AppHeader.tsx) 有「切換模式」「登出」等後台才需要的東西）、預約是 2 步塞滿的長表單（[`BookingPage.tsx`](../frontend/src/pages/BookingPage.tsx) 809 行）、`manifest` 只有一顆 SVG icon、沒有安裝引導、沒有更新提示、iOS 無 apple-touch-icon。 | `manifest.webmanifest`、`index.html` |
| 6 | **部署綁死**：`vercel.json` 一個專案同時 build 前端靜態與後端 function；前端任一邊要獨立發佈 / 回滾都不行。 | [`vercel.json`](../vercel.json) |

> 附註：repo 內 [`demo/`](../demo) 是一份 qiankun + antd 的 micro-frontend 樣板，與本系統無關，本次不納入。

---

## 2. 目標與非目標

### 目標

- 使用者端與後台**各自獨立**：獨立程式碼邊界、獨立設計系統、獨立部署與回滾、獨立 PWA / SW scope。
- 使用者端重構為**手機優先、仿生 App 體驗**的 PWA：App 殼（底部 tab、無網頁感）、可安裝、可離線開啟外殼、有更新提示、動效與觸控回饋、完整 icon / manifest。
- 使用者端畫面**依專業 UI/UX 全面重畫**：單一、一致、對長輩友善的設計系統；把 2 步長表單改成單一決策一頁的精靈流程。
- 後台**維持 Web、桌機優先**，但擺脫色彩 hack、拿掉不該存在的手機殼、加上「非後台權限」友善擋門。
- 共用邏輯（型別、API、驗證、衝突判定、場地網格）集中一處，避免兩份 drift。
- `backend/` API 合約不變。

### 非目標（本期不做）

- 不改後端業務邏輯、不改資料庫 schema、不改 API 路徑與回應格式。
- 不改權限模型（角色仍是 `user` / `admin` / `system_admin` / `inspector`）。
- 不導入新框架（維持 React 19 + Vite + Tailwind）；不導入 Turborepo / Nx（npm workspaces 足夠）。
- 不做使用者端的離線預約排隊（沿用 [`PWA_ARCHITECTURE.md`](../frontend/docs/PWA_ARCHITECTURE.md)：預約寫入一律 online-only）。
- 後台不做 PWA、不做手機版重構（僅保留最小可用 RWD 到平板）。
- 不合併「兩邊各自登入」為單一 SSO（見 §3.6 與 §7）。

---

## 3. 拆分策略

### 3.1 三種部署形態比較

| 形態 | 說明 | PWA scope | 部署 / 回滾 | Cookie / Storage | 評價 |
|---|---|---|---|---|---|
| **A. 單 origin，路徑分流** | 同一網域，`/` = 使用者端、`/console` = 後台 | SW 在 `/`，需寫規則排除 `/console`，易誤快取 | 綁一起 | 共用 → 後台的東西可能被 SW 快取 | ✕ 沒解決痛點 4、6 |
| **B. 兩個 origin（子網域）** | `booking.<教會網域>` + `console.<教會網域>`，各自 Vercel 專案 | 各自 `/`，乾淨 | 各自獨立 | 天然隔離 | ✅ **建議** |
| **C. 兩個完全不同網域** | 同 B 但不共用父網域 | 同 B | 同 B | 同 B（更隔離） | ○ 可，但少了未來共用 cookie 的彈性 |

### 3.2 建議：兩個 origin + 一個 monorepo

- **Repo 結構不拆**（維持一個 git repo、一份 `migration/`、一份 `docs/`），用 **npm workspaces** 收三個 package。root 已經有 workspaces 式的 `install:all` / `concurrently`（[`package.json`](../package.json)），只需正式宣告 `workspaces`。
- **部署拆成三個 target**：`apps/member`、`apps/console`、`backend`。可以是「一個 Vercel 專案 + 三個 build」或「三個 Vercel 專案」。建議**三個專案**：`member` / `console` / `api`，各自網域、各自環境變數、各自發佈節奏。

### 3.3 目標目錄結構

```
space-booking-system/
├── package.json                 # workspaces: ["apps/*", "packages/*", "backend"]
├── .env                         # VITE_SUPABASE_* 仍集中在 root（envDir 指到這裡）
├── backend/                     # 不動（僅收緊 CORS）
├── packages/
│   └── shared/                  # @church/shared
│       ├── types.ts             #  ← 由 frontend/src/lib/types.ts 搬入
│       ├── api.ts               #  ← 由 frontend/src/lib/api.ts 搬入
│       ├── supabase.ts          #  ← frontend/src/lib/supabase.ts
│       ├── auth/                #  ← AuthContext.tsx + contexts/auth-context.ts + hooks/useAuth.ts
│       ├── constants.ts         #  ← BRANCHES 等
│       └── domain/
│           ├── roomGrid.ts          #  ← frontend/src/lib/roomGrid.ts
│           └── bookingConflicts.ts  #  ← frontend/src/lib/bookingConflicts.ts
├── apps/
│   ├── member/                  # 使用者端 PWA（@church/member）
│   │   ├── index.html
│   │   ├── vite.config.mjs      # /api proxy + manualChunks（沿用現有）
│   │   ├── public/
│   │   │   ├── manifest.webmanifest   # 重寫（§4.5）
│   │   │   ├── sw.js / sw/            # 沿用現有骨架，scope = 整個 origin
│   │   │   └── icons/                 # 192 / 512 / maskable / apple-touch
│   │   └── src/
│   │       ├── app/            # App 殼：BottomNav、Header、Router、SafeArea
│   │       ├── screens/        # 逐頁（§4.3）
│   │       ├── ui/             # 設計系統元件（§4.4）
│   │       └── features/       # booking draft、pwa install/update
│   └── console/                # 後台控制台 Web（@church/console）
│       ├── index.html
│       ├── vite.config.mjs
│       └── src/
│           ├── layout/        # Sidebar + Topbar（由 AdminPanel.tsx 抽出）
│           ├── tabs/          # ← frontend/src/pages/admin/* 原封搬入
│           ├── SuperAdmin/    # ← SuperAdminPanel.tsx
│           └── ui/            # 後台自己的淺色設計系統（§5.4）
├── migration/
└── docs/
```

### 3.4 `packages/shared` 邊界

**放進 shared（兩邊都要、且與外觀無關）：**

- `types.ts` — 全部型別定義（`Booking` / `Room` / `ViolationRecord` …）。
- `api.ts` — 所有 `fetch('/api/...')` 封裝。兩個 app 都用相對路徑 `/api`，由各自 Vite dev proxy / Vercel rewrite 指到 `api` 部署。
- `supabase.ts` + `auth/` — Supabase client、`AuthProvider`、`useAuth`、`getToken`。
- `constants.ts` — `BRANCHES` 等純資料。
- `domain/roomGrid.ts`、`domain/bookingConflicts.ts` — 純函式，會眾「檔期概況」與後台「衝突看板」都要用。

**不放進 shared（各自一份）：**

- 任何 `.css` / Tailwind 設定 / 設計 token — 兩套系統。
- 所有畫面元件。**例外討論**：`WeeklyBulletin.tsx`（1166 行）目前**會眾唯讀**與**後台**都在用。短期先讓它整包住 shared 當共用元件（props 控制 `isAdmin`），P3 再決定要不要各自 fork。此點列入 §8。

**shared 的形態**：純 TS/TSX source，透過 workspace `"@church/shared": "*"` 直接被 Vite 吃，不需獨立 build step。`peerDependencies`: react、@supabase/supabase-js。

### 3.5 路由、網域與部署

| 項目 | member | console | api |
|---|---|---|---|
| 開發網址 | `localhost:5173` | `localhost:5174` | `localhost:3001` |
| 開發 `/api` | Vite proxy → `:3001`（沿用 [`vite.config.mjs:7-14`](../frontend/vite.config.mjs:7)） | 同左 | — |
| 正式網域（建議） | `booking.<教會網域>` | `console.<教會網域>` | `api.<教會網域>` 或各 app 用 Vercel rewrite `/api/*` → api 部署 |
| Vercel 專案 | 靜態（`@vercel/static-build`, `distDir: dist`） | 靜態 | `@vercel/node`（= 現在的 `backend/index.js`） |
| 環境變數 | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 同左 | `SUPABASE_*`、`FORM_INTAKE_SECRET` … |

- root `vercel.json` 拆成每個 app 目錄各自一份 `vercel.json`（或改用三個 Vercel 專案，各自設 root directory）。
- `envDir`：檔案從 `frontend/` 移到 `apps/member/` 後，Vite `envDir` 由 `'../'` 改成 `'../../'`（指回 root `.env`）。
- `member` 需要 SPA fallback（`/(.*) → index.html`）；`console` 同樣。

### 3.6 身分驗證與權限影響

- **Supabase redirect**：`redirectTo: window.location.origin` 已經是「每 origin 各自對」的寫法。動作項：在 Supabase Auth 設定把 `booking.*` 與 `console.*` 兩個 origin 都加入 **Allowed Redirect URLs**。
- **Session 儲存**：Supabase JS 預設把 session 放 `localStorage`，**per origin**。因此「同工要用會眾功能借場地」時，需要在 `booking.*` 與 `console.*` **各登入一次**。這是可接受的取捨（見 §7）；多數同工日常只開其中一邊。
- **權限擋門**：
  - `member`：所有角色都能進（`user` / `admin` / `inspector` / `system_admin` 都可以借場地）。移除 app 內的 `adminMode` / `AdminModeSelector` / `isAdmin` 條件渲染 —— 使用者端**不再有後台入口**。
  - `console`：載入後 `useAuth().role === 'user'` → 顯示「此帳號沒有後台權限」的整頁擋門（含「前往預約系統 →」連到 `booking.*`）。`inspector` 只看得到清潔 / 概況 / 故障（沿用 [`AdminPanel.tsx:150`](../frontend/src/AdminPanel.tsx:150) 既有邏輯）。
- **後端 authMiddleware 不變**：仍驗 Supabase JWT，角色仍從 DB 查。

### 3.7 後端影響

- 目前 [`backend/index.js:23`](../backend/index.js:23) 是 `app.use(cors())`（全開）。拆分後建議收緊成白名單：`[booking origin, console origin, localhost:5173, localhost:5174]`。**這是唯一需要動 backend 的地方**，且非阻塞（全開也能跑）。
- `/api/intake/form`（Google 表單 webhook）不受影響。

---

## 4. 使用者端 PWA 重構設計

### 4.1 設計原則（仿生 App）

1. **像 App，不像網頁**：固定的頂部細列 + 底部 tab bar；內容區在中間捲動；不出現「網頁 header / footer」。尊重 `env(safe-area-inset-*)`。
2. **一次一個決策**：預約流程從「2 大步塞滿」改為「單頁單題」的精靈，底部固定主 CTA。
3. **即時回饋**：按壓 scale 0.97、切換頁面滑入、bottom sheet 彈出、骨架屏取代空白、送出有 optimistic + toast。
4. **對長輩友善**：內文最小 16px、觸控目標 ≥ 44×44、色彩對比 WCAG AA 以上、狀態不只靠顏色（配文字 + icon）、少階層少行話。
5. **單一主題**：拿掉深/淺打架。**建議採用溫暖淺色（warm paper）單一主題**（理由見 §4.4）。深色模式列為 P2 之後的可選項，非首發。
6. **離線誠實**：外殼與最後一次的公告 / 首頁可離線開啟並標示「離線資料」；預約相關動作離線時明確禁用（沿用現有規則）。

### 4.2 資訊架構與導覽模型

```
啟動 → (未登入) 登入頁
     → (已登入、未選據點) 選擇據點
     → (已登入、已選據點) App 殼
          ├─ [tab] 首頁      Home
          ├─ [tab] 預約      Booking 精靈（6 步）
          ├─ [tab] 檔期      Weekly / Day 概況
          └─ [tab] 我的      我的預約紀錄
        頂列：據點切換鈕 · 個人資料（頭像）
        情境子流程（push 或 sheet，不佔 tab）：
          · 公告列表 / 公告詳情          （從首頁進）
          · 婚禮與重要活動               （從首頁進）
          · 清潔歸還回報（sheet）        （從「我的」某筆進）
          · 場地問題回報                 （從「我的」某筆進）
          · 違規 / 停權明細（sheet）     （從首頁狀態列進）
```

- Tab 對應現有 `activeTab`：`home` / `booking` / `weekly` / `records`（與 [`App.tsx:557-563`](../frontend/src/App.tsx:557) 現有底部 nav 一致，只是重新設計外觀與轉場）。
- `system`（帳戶管理）→ **移出使用者端**，只在 `console`。
- 「切換模式 / 返回模式選擇」→ **刪除**。

### 4.3 畫面清單與逐頁規格

> 對照現有檔案：本節每頁標註「← 由哪支重畫」。重畫 = 換版面與設計系統，商業邏輯（hooks / api）沿用。

#### 4.3.1 登入 ← `Login.tsx`

- 滿版、不可捲動。App icon + 名稱 + 一句話 + 單顆「使用 Google 登入」大鈕（min-height 52，已是現況）。
- 背景用低調的暖色漸層 / 教會意象，移除現在的深色網格光暈。
- 錯誤訊息 inline。

#### 4.3.2 選擇據點 ← `HomePage.tsx`（`!currentBranch` 分支）+ `BranchSelectPage.tsx`

- 2 欄大卡（`BRANCHES` 4 個），每張 min-height ~148（現況已如此），icon + 名稱 + 「進入」。
- 選過後寫 `localStorage`，下次直接進首頁；頂列據點鈕可再切換。

```
┌───────────────────────────────┐
│           (App icon)          │
│      主內同工與會眾場地預借     │
│                               │
│  ┌──────────┐  ┌──────────┐   │
│  │  仁愛堂  │  │  士林堂  │   │
│  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐   │
│  │   新莊   │  │   大福   │   │
│  └──────────┘  └──────────┘   │
└───────────────────────────────┘
```

#### 4.3.3 首頁 ← `HomePage.tsx`（`currentBranch` 分支，675 行 → 大幅精簡）

- **頂列**（sticky, 44）：`據點 ▾` + 頭像。
- **問候列**：早安 + 姓名（沿用 `getGreeting()`）。
- **資格狀態 strip**（一行，可點）：綠點「牧區借用資格正常」/ 紅「已被暫停」/ 黃「尚未設定牧區」。點開 → 違規明細 sheet。把現在 200+ 行的巢狀條件（[`HomePage.tsx:181-366`](../frontend/src/pages/HomePage.tsx:181)）收斂成 1 個狀態元件 + 1 個 sheet。
- **主 CTA 卡**：「立即預約教會場地 →」。
- **快捷 3 宮格**：檔期概況 / 我的紀錄 / 婚禮與重要活動。
- **最新公告**：最多 3 則，點開 sheet；標題列可點進公告列表。
- **下拉刷新**（pull-to-refresh）重抓公告 / 資格。
- 首頁可離線開啟（顯示上次快取 + 「離線資料」標記）。

```
┌───────────────────────────────┐
│ 仁愛堂 ▾                  (WM) │  sticky 44
├───────────────────────────────┤
│ 早安，王小明                   │
│ ● 牧區「大安6區」借用資格正常  │ → sheet
├───────────────────────────────┤
│ ┌───────────────────────────┐ │
│ │  立即預約教會場地       →  │ │  primary card
│ └───────────────────────────┘ │
│ ┌──────┐ ┌──────┐ ┌────────┐ │
│ │ 檔期 │ │ 紀錄 │ │婚禮重要│ │
│ └──────┘ └──────┘ └────────┘ │
├───────────────────────────────┤
│ 最新公告                    →  │
│ ┌───────────────────────────┐ │
│ │ 09/10 · 冷氣維修公告       │ │
│ │ 09/05 · 中秋節開放時間     │ │
│ └───────────────────────────┘ │
├───────────────────────────────┤
│  🏠 首頁   📅 預約   🗓 檔期   👤 我的 │  bottom nav 64 + safe area
└───────────────────────────────┘
```

#### 4.3.4 預約精靈 ← `BookingPage.tsx`（809 行、2 步 → 6 單題步驟）

改成滿版精靈，頂列有進度條，底部固定「下一步 / 確認」。沿用 `useBooking` hook、時段格子邏輯、`roomAvailability`、停權檢查、草稿自動存（`BookingDraftService` 已存在）。

| 步 | 內容 | 對應現有 |
|---|---|---|
| 1 | **借用類型**：一般 / 婚禮 / 重要 / 取消或異動（大卡選擇，不用下拉） | `bookingState.bookingType` |
| 2 | **借用人資料**：姓名 / 電話 / 牧區（已從 profile 預填 → 多數人直接下一步）；「取消或異動」則在這步選要更動的預約 + 原因 | step 1 前半 |
| 3 | **選日期**：月曆元件（`min`/`max` 沿用 `getMinMaxDates`） | step 2 日期 |
| 4 | **選時段**：垂直時間軌，點/滑選區間，區塊 ≥ 44 高，頂部 sticky 顯示「已選 15:00–17:30」；可「＋ 再加一個時段」 | `TimeGridSelector` |
| 5 | **選場地**：照片卡 + 容納人數 + 可用狀態徽章；用 segmented control 切樓層；不可用的顯示原因（時段已被預訂 / 人數不足） | step 2 場地 |
| 6 | **用途 + 確認**：每個場地填用途，最後一張「確認卡」列出全部明細 → 「確認送出」 | step 2 後半 + confirm |

- 底部 CTA 區固定（76 + safe area），不隨內容捲走。
- 離線：CTA 禁用 + 橫幅（沿用 `useOnlineStatus`）。
- 中途離開自動存草稿，回來問「繼續上次填寫？」（草稿 ≠ 保留名額，明確標示）。

```
┌───────────────────────────────┐
│ ←  新增預約           ▓▓▓░░ 4/6│  header + 進度
├───────────────────────────────┤
│ 步驟 4 · 選擇時段              │
│ ┌───────────────────────────┐ │
│ │ 已選：15:00 – 17:30        │ │ sticky
│ ├───────────────────────────┤ │
│ │ 09:00 ▢▢▢▢                 │ │
│ │ 10:00 ▢▢▢▢                 │ │
│ │ …                          │ │
│ │ 15:00 ██▨▨  ← 拖選         │ │
│ └───────────────────────────┘ │
│ ＋ 再加一個借用時段           │
├───────────────────────────────┤
│            下一步  →           │  sticky footer
└───────────────────────────────┘
```

#### 4.3.5 檔期概況 ← `WeeklyBulletin.tsx`（會眾唯讀模式）

- 手機改「**單日為主**」：頂部水平日期條（左右滑切日），下方**場地為欄、時段為列**的縱向捲動網格。
- 點某個預約塊 → 詳情 sheet（借用人 / 時間 / 用途）。
- 空檔塊點下去 → 帶日期 / 場地跳到預約精靈（沿用 `startBookingFromCalendar`，[`App.tsx:520`](../frontend/src/App.tsx:520)）。
- 桌機 / 平板仍可切「整週」。

#### 4.3.6 我的預約 ← `RecordsPage.tsx`（545 行）

- 分段：**即將到來** / **待清潔歸還** / **已完成** / **未通過**。
- 每列：場地 · 日期時間 · 狀態 pill。點開 → 詳情 sheet：
  - `已核可`：**門鎖密碼**（點按顯示 / 一鍵複製）、清潔歸還回報鈕、回報場地問題。
  - `審核中`：可送「取消或異動」。
  - `未通過`：顯示退回原因。
- 搜尋 / 篩選收進頂部一顆「篩選」開關（現在是常駐三欄，手機太擠）。

```
                 ┌──────────────────┐
                 │  ═══             │  bottom sheet
                 │ 大禮堂            │
                 │ 已核可 · 7/16     │
                 │ 09:00 – 12:00     │
                 │ 門鎖密碼 ••••••  👁 複製 │
                 │ ┌──────────────┐ │
                 │ │  清潔歸還回報 │ │
                 │ └──────────────┘ │
                 │  回報場地問題     │
                 └──────────────────┘
```

#### 4.3.7 清潔歸還 ← `CleanupModal.tsx`（426 行）

- 從中央 modal 改 **bottom sheet**：檢查清單（冷氣 / 大燈 / 垃圾 / 歸位）+ 備註 + 送出。邏輯不變。

#### 4.3.8 場地問題回報 ← `IssueReportPage.tsx` / `useIssueReport`

- push 進來的整頁：選對象（下拉或該筆預約帶入）+ 描述 + 送出。維持現況邏輯，只換版。

#### 4.3.9 公告 ← `AnnouncementsPage.tsx` + 詳情 sheet

- 列表 + sheet，取代現在的中央 modal。

#### 4.3.10 婚禮與重要活動 ← `SpecialEventsPage.tsx`（982 行，會眾唯讀）

- 時間軸唯讀檢視；手機改單欄卡片時間軸。

#### 4.3.11 個人資料 ← `ProfileModal.tsx`

- 頭像點開的 bottom sheet：姓名 / 電話 / 牧區 / 登出。首次登入強制填（沿用 [`App.tsx:181-207`](../frontend/src/App.tsx:181)）。

#### 4.3.12 系統狀態畫面（新增）

- **離線**：頂部細橫幅「離線中，僅能瀏覽」。
- **有新版本**：SW 偵測到 `waiting` → 底部 toast「有新版本，點擊更新」→ `postMessage('SKIP_WAITING')` + reload（骨架已在 [`sw.js:46`](../frontend/public/sw.js:46)）。
- **安裝引導**：見 §4.5。

### 4.4 設計系統

#### 主題方向

**建議：單一「暖色淺色」主題。** 理由：

1. 使用者多在教會大廳 / 戶外用手機，淺色高亮度可讀性好。
2. 現況已在「深色殼 + 硬改淺色的預約 / 後台」之間打架；統一成淺色，後台本來就是淺色，兩邊心智一致。
3. 會眾族群年齡分布廣，淺底深字 + 大字級的無障礙成本最低。
4. 保留現有品牌琥珀 `#f0b44d` 當**點綴色**（pill / highlight），但**主要動作與連結**改用高對比的深靛藍，避免「琥珀字在白底」不過 AA。

（若最終決定沿用深色海軍藍品牌 → 見 §8，設計 token 骨架不變，只換數值。）

#### 色彩 token（淺色）

| token | 值 | 用途 | 對比 |
|---|---|---|---|
| `--bg` | `#FAF8F5` | 頁面底 | — |
| `--surface` | `#FFFFFF` | 卡片 / sheet | — |
| `--surface-sunken` | `#F1ECE4` | 輸入框底 / 次級區塊 | — |
| `--border` | `#E5DED3` | 分隔線 / 卡片描邊 | — |
| `--ink` | `#1F1D1B` | 主要文字 | 〜15:1 on `--bg` |
| `--ink-soft` | `#5B5750` | 次要文字 | 〜7:1 |
| `--ink-faint` | `#8A857C` | 輔助（僅大字 / 非關鍵） | 〜4.6:1 |
| `--primary` | `#3A4E8C` | 主要按鈕 / 連結 / 選取 | 白字 〜7:1（AAA） |
| `--primary-ink` | `#FFFFFF` | primary 上的文字 | |
| `--primary-soft` | `#EAEEF7` | 選取態底 / tab active 底 | |
| `--accent` | `#E0982F` | 品牌點綴（pill、標記）；**不用於白底內文** | |
| `--success` | `#2E7D53` | 已核可 / 正常 | 白字 4.7:1 |
| `--warning` | `#A96A16` | 審核中 / 提醒 | 白字 4.6:1 |
| `--danger` | `#B4302B` | 退回 / 停權 / 錯誤 | 白字 5.9:1 |

- **狀態一律「顏色 + 文字 + icon」三者齊全**，不單靠色（沿用 repo 既有無障礙立場，`index.css:240` 的補丁思路正規化）。
- 深色模式：P2 之後可選，`:root` token 換 `@media (prefers-color-scheme: dark)` 一組值即可，元件不用改。

#### 字級（px / 行高 / 字重）

| 級 | 尺寸 | 用途 |
|---|---|---|
| Display | 30 / 38 / 800 | 畫面主標題 |
| Title | 22 / 30 / 700 | 區塊標題 / sheet 標題 |
| Headline | 18 / 26 / 700 | 卡片標題 |
| Body-L | 17 / 26 / 500 | 重點內文 |
| Body | 16 / 24 / 500 | 內文、**所有 input 最小值**（避免 iOS 自動放大） |
| Label | 14 / 20 / 600 | 欄位標籤 |
| Caption | 13 / 18 / 500 | 輔助說明 |
| Micro | 12 / 16 / 600 | tab 標籤 / pill |

字體：`"Inter", "Noto Sans TC", system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif`（現在只 preload Inter，中文 fallback 未指定 → 補 Noto Sans TC）。

#### 間距 / 圓角 / 陰影

- 間距基準 4；行內 8 / 12；**畫面左右留白 16**；卡片內距 16–20；區塊間距 24–32。
- 圓角：控件 12、卡片 16、sheet 頂 24、pill 999、頭像 12。
- 陰影：卡片 `0 1px 2px rgba(31,29,27,.06)` + 1px border（扁平）；sheet `0 -8px 40px rgba(31,29,27,.16)`；不用更重的陰影。
- 底部 nav 高 64 + `env(safe-area-inset-bottom)`；sticky CTA 區 76 + safe area。

#### 核心元件（`apps/member/src/ui/`）

| 元件 | 說明 |
|---|---|
| `AppShell` | Header(44) + `<Outlet>` + BottomNav(64+safe)，處理 safe-area 與捲動容器 |
| `BottomNav` | 4 顆，active = `--primary` 字 + `--primary-soft` 底；按壓 scale .94（沿用 `.mobile-app-nav`） |
| `Screen` | 每頁外框：標題列（可帶返回 / 進度）、可捲內容、可選 sticky footer |
| `Sheet` | bottom sheet：拖曳把手、背景遮罩、`Esc` / 下滑關閉、`prefers-reduced-motion` 時改淡入 |
| `SegmentedControl` | 樓層 / 分段切換 |
| `ListRow` | 左圖示 + 主副標 + 右徽章 / chevron；min-height 56 |
| `StatusPill` | 顏色 + icon + 文字 |
| `Button` | primary / secondary / ghost / danger；min-height 48；按壓 scale .97；loading 態 |
| `Field` | label + input(min-h 48, 16px) + 錯誤訊息 + 說明 |
| `StatStrip` | 首頁資格狀態那一行 |
| `Skeleton` | 骨架屏（沿用 `.skeleton` shimmer） |
| `EmptyState` | icon + 一句話 + 可選行動 |
| `Toast` | 由現有 `StatusToast.tsx` 演進；成功 / 失敗 / 更新提示 |
| `PullToRefresh` | 首頁 / 檔期 / 我的 |

#### 動效

- Tab 切換：crossfade 160ms。
- 子頁 push：從右滑入 240ms `cubic-bezier(.2,.8,.2,1)`。
- Sheet：translateY 彈簧 〜280ms。
- 按壓：scale .97 / 120ms。
- 全部包在 `@media (prefers-reduced-motion: reduce)` 降級為純淡入（`index.css:257` 已有骨架）。
- 用 `framer-motion`（已是相依）。

#### 圖示

- `lucide-react`（已相依），線寬 2，尺寸 20（列內）/ 24（tab、標題）。

### 4.5 PWA 技術規格

#### `manifest.webmanifest`（重寫）

```jsonc
{
  "name": "教會場地借用",
  "short_name": "場地借用",
  "id": "/",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "portrait",
  "lang": "zh-Hant",
  "dir": "ltr",
  "theme_color": "#FAF8F5",          // = header 底色，與 index.html <meta theme-color> 一致
  "background_color": "#FAF8F5",      // = splash 底色
  "categories": ["productivity"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/icons/shot-home.png", "sizes": "1170x2532", "type": "image/png", "form_factor": "narrow" }
  ],
  "shortcuts": [
    { "name": "立即預約", "url": "/booking?source=shortcut" },
    { "name": "我的預約", "url": "/records?source=shortcut" }
  ]
}
```

- 現況只有 1 顆 SVG「any maskable」（[`manifest.webmanifest`](../frontend/public/manifest.webmanifest)）→ 補齊 PNG 尺寸與**分開的 maskable**。
- `theme_color` 現在 `#0f172a`（深藍）與新淺色殼不符 → 統一。

#### `index.html` `<head>` 補強

```html
<meta name="theme-color" content="#FAF8F5" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="場地借用" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

- `viewport-fit=cover` 才能吃到 safe-area inset。

#### Service Worker

- **策略不變**（照 [`PWA_ARCHITECTURE.md`](../frontend/docs/PWA_ARCHITECTURE.md)）：
  - `install` precache 最小殼；`activate` 清舊快取 + `clients.claim()`。
  - 導覽 = Network First + 快取殼 fallback。
  - 同源靜態資源 = Cache First。
  - `/api/*` = Network Only（永不快取、不排隊）。
  - 不註冊 `sync`；預約寫入 online-only。
- **scope 變乾淨**：拆分後整個 `booking.*` origin 都是使用者端，`sw.js` 不用再擔心誤攔後台。
- `sw/config.js` 的 `CACHE_VERSION` 在切換時 +1。
- Vite 產物 hash 命名 → `VITE_ASSET_PATTERN`（[`sw/config.js:17`](../frontend/public/sw/config.js:17)）沿用即可。

#### 安裝 UX

- **Android / Chrome**：攔 `beforeinstallprompt`，存起來；在首頁第 2 次造訪後顯示可關閉的「安裝 App」列；點擊呼叫 `prompt()`。
- **iOS Safari**：無 `beforeinstallprompt` → 顯示「加入主畫面」教學 sheet（分享鈕 → 加入主畫面），偵測 `navigator.standalone` 已安裝則不顯示。
- 安裝後 `start_url` 帶 `?source=pwa`，可用於日後分析。

#### 更新 UX

- `PwaService` 監聽 `registration.waiting` / `updatefound`；有新版 → Toast「有新版本，點擊更新」→ `waiting.postMessage({type:'SKIP_WAITING'})` → `controllerchange` 時 `location.reload()`。

#### 離線 UX

- 外殼恆可開。
- 首頁：顯示最後一次成功抓到的公告 / 資格，標「離線資料 · 最後更新 HH:MM」。
- 預約 / 檔期即時資料：離線顯示 EmptyState「需要連線才能查看最新檔期」。
- 預約送出：離線時 CTA 禁用 + 說明（沿用 `useOnlineStatus`）。

#### 舊 Service Worker 汰換（重要，見 §7 風險 2）

使用者手機上可能還跑著「舊的、單一 origin」SW。切換網域後：

- 若新舊**同網域**（例如舊的就是 `booking.*` 直接原地重構）→ 靠 `CACHE_VERSION` +1 + `skipWaiting` + `clients.claim` 自然換掉。
- 若**換了網域**（舊 `app.*` → 新 `booking.*`）→ 在舊網域部署一支**自我卸載**的 `sw.js`（`registration.unregister()` + 清 `caches` + 導向新網域），`PwaService` 已有類似清理骨架（[`PwaService.ts:30-49`](../frontend/src/services/pwa/PwaService.ts:30)）可參考。

### 4.6 無障礙（WCAG 2.2 AA 起跳）

- 對比：見 §4.4 token（內文 ≥ 4.5:1、大字 ≥ 3:1、UI 元件 ≥ 3:1）。
- 觸控目標 ≥ 44×44（AA 2.5.8）。
- 焦點可見：沿用 `:focus-visible` 3px outline（[`index.css:64`](../frontend/src/index.css:64)）。
- 狀態不只靠色：pill 一律帶文字 + icon。
- 動態尊重 `prefers-reduced-motion`。
- `<html lang="zh-Hant">`；表單 `<label for>`；sheet 有 `role="dialog"` `aria-modal` + focus trap + 關閉回焦。
- 動態訊息用 `aria-live`（現有 `role="status"` 思路延續）。

---

## 5. 後台控制台（保留 Web）設計

### 5.1 定位與範圍

- **桌機優先的營運工具**，功能與現況一致：預約審核、衝突拖曳看板、門鎖密碼、婚禮專區、清潔稽核、故障、違規、公告、場地 / 公共空間配置、Tuya、即時地圖、借用概況、（system_admin）帳戶權限。
- 不做 PWA、不裝 Service Worker、不做手機重構。

### 5.2 版面與 RWD 斷點

| 寬度 | 行為 |
|---|---|
| ≥ 1280 | 側邊欄常駐 + 內容區（現況桌機版，[`AdminPanel.tsx:337-573`](../frontend/src/AdminPanel.tsx:337)） |
| 1024–1279 | 側邊欄可收合；內容單欄 |
| 768–1023（平板） | 側邊欄變頂部抽屜；表格允許橫向捲動 |
| < 768（手機） | **不再提供完整後台**。顯示「請用電腦或平板開啟管理後台」＋（可選）一個極簡「待審核快速核可」清單 |

### 5.3 拆分後可移除 / 簡化

| 項目 | 動作 | 省下 |
|---|---|---|
| [`MobileAdminDashboard.tsx`](../frontend/src/components/MobileAdminDashboard.tsx) | **刪除**（或縮成 §5.2 的極簡待審核清單） | ~1045 行 |
| `MobileAdminDashboard.test.tsx` | 隨之刪 / 改 | |
| [`AdminModeSelector.tsx`](../frontend/src/components/AdminModeSelector.tsx) | **刪除**（不再有「借用 / 管理」模式切換） | ~100 行 |
| `App.tsx` 的 `adminMode` / `isAdmin` 條件渲染、`onSwitchMode`、底部 nav 的 `adminMode` 判斷 | **刪除**；`console` 的 `App` 只做「登入 → 選據點 → 後台」 | `App.tsx` 由 612 行大幅縮減 |
| `AppHeader.tsx` 的「切換模式」「返回模式選擇」 | 移除；member / console 各留各自需要的 | |
| `tailwind.config.js` 把 `indigo`/`violet` 覆寫成琥珀 | **移除**；console 用真正的 indigo/slate（見 §5.4） | 消除一大類「為什麼這顏色不對」的困惑 |
| `index.css` 的 `.admin-workspace` 淺色補丁、`.booking-app` 補丁、`text-white/xx` 對比補丁 | 拆到各自 app 的正規 token，刪補丁 | |

### 5.4 後台設計系統

- **自己的淺色系統**，不再寄生在深色 token 上：
  - 底 `#F8FAFC`(slate-50) / 卡片白 / 邊 `#E2E8F0`(slate-200) / 主色真正的 `indigo-600` `#4F46E5` / 文字 slate-800/600/400。
  - 這正是現在 `.admin-workspace` 想達成、卻要靠一堆 `!important` 硬凹的樣子（[`index.css:252-255`](../frontend/src/index.css:252)）。拆開後直接寫對即可。
- 版面元件：`Sidebar`（分組導覽，沿用 [`AdminPanel.tsx:398-453`](../frontend/src/AdminPanel.tsx:398) 的分組）、`Topbar`（據點 + 角色 + 登出）、`TabContent`、`DataTable`、`Modal`、`Toast`。
- 分頁內容（`pages/admin/*`）**原封搬進 `apps/console/src/tabs/`**，只改 import 路徑與把「深色殘影」清乾淨。
- 權限擋門：`role === 'user'` → 整頁「此帳號沒有後台權限 · 前往預約系統」。

---

## 6. 分階段實作計畫

| 階段 | 目標 | 內容 | 驗收 |
|---|---|---|---|
| **P0** | 拍板 | 決定：主題方向（淺色 / 沿用深色）、正式網域、手機後台留不留、`WeeklyBulletin` 共用或 fork（§8） | 本報告 §8 全部有結論 |
| **P1** ✅ | Monorepo 拆分（**零外觀變更**） | ① root 宣告 `workspaces`；② 建 `packages/shared`，把 `types/api/supabase/auth/constants/domain` 搬入（另含 Login/WeeklyBulletin/SpecialEventsPage 共用視圖）；③ `frontend/` → `apps/member`（會眾頁）＋ `apps/console`（後台）；④ 兩 app 各自 `vite.config.mjs` / `index.html` / `public/`；⑤ `vercel.json` 指向 member+backend，`apps/console/vercel.json` 為獨立 console 專案；⑥ `backend` CORS 收白名單（`ALLOWED_ORIGINS`，未設時維持寬鬆）。 | ✅ 兩 app `tsc -b` + `eslint` + `vite build` 全過；`@church/shared` 獨立 `tsc` 全過；兩 app dev server 皆可開、渲染登入頁、無 console error。**待人工**：Supabase Auth 加 `booking.*` / `console.*` 兩個 redirect URL（P4 綁網域時一併）；`⑦` 三個 Vercel 專案的實際綁定留待 P4。 |
| **P2** | 使用者端 PWA 重構 | ① 落地 §4.4 設計系統與 `ui/` 元件；② `AppShell` + `BottomNav` + 轉場；③ 逐頁重畫，優先序：首頁 → 預約精靈 → 我的 → 檔期 → 公告 / 婚禮 / 清潔 / 問題 / 個資；④ `manifest` + icon 全套 + `index.html` head；⑤ 安裝 / 更新 / 離線 UX；⑥ 舊 SW 汰換。 | Lighthouse PWA 通過（installable、SW、manifest）；行動裝置實機走完整預約；離線可開殼；`prefers-reduced-motion` 正常 |
| **P3** | 後台整理 | ① 刪 `MobileAdminDashboard` / `AdminModeSelector` / `adminMode` 相關；② 移除 `tailwind` 色彩 hack 與 `index.css` 補丁，落地 §5.4；③ 平板 RWD；④ `role==='user'` 擋門；⑤ 死碼清理、`App.tsx` 瘦身。 | 後台桌機 / 平板走查；手機顯示提示頁；無 indigo→琥珀殘留 |
| **P4** | 切換 | ① 綁正式網域（`booking.*` / `console.*` / `api.*`）；② 舊網址 301 或自我卸載 SW 導向；③ `CACHE_VERSION` +1；④ 對使用者公告「請重新把預約系統加入主畫面」。 | 舊裝置開舊網址會被導到新站且不殘留舊 SW |

---

## 7. 風險與緩解

| # | 風險 | 影響 | 緩解 |
|---|---|---|---|
| 1 | **同工要在 member 與 console 各登入一次** | 體驗小摩擦 | 兩邊都用同一個 Google OAuth，實際只是多點一次「用 Google 登入」（不用重打密碼）。若日後真的要 SSO：改用共用父網域 + cookie-based session storage（需自寫 Supabase storage adapter），列為 backlog。 |
| 2 | **使用者手機殘留舊 Service Worker / 舊快取** | 切換後可能開到舊殼、或載入失敗 | §4.5「舊 SW 汰換」：同網域靠 `CACHE_VERSION` + `skipWaiting` + `clients.claim`；換網域則在舊站放自我卸載 SW。P4 前先在測試機驗證。 |
| 3 | `WeeklyBulletin` / `SpecialEventsPage` 兩邊共用元件，日後 drift | 維護風險 | 純邏輯（`roomGrid` / `bookingConflicts`）進 shared；大型檢視元件短期整包住 shared（props 分流），P3 再評估 fork。§8 決策。 |
| 4 | 「重構」範圍蔓延 | P2 無限延長 | P0 鎖定 §4.3 畫面清單為唯一範圍；新需求一律進 backlog。 |
| 5 | monorepo workspace 相依解析 / Vite 吃 shared source | build 失敗 | shared 以 TS source 直出、`"@church/shared": "*"`；Vite `resolve` 預設可吃 workspace 套件。P1 先做一支最小 smoke build。 |
| 6 | 環境變數位置改變（`envDir`） | 本地跑不起來 | P1 一併更新 `vite.config.mjs` 的 `envDir: '../../'`，並在 `README` / `PROJECT_ARCHITECTURE.md` 補說明。 |
| 7 | 後端 CORS 收白名單後漏掉某 origin | 前端打 API 失敗 | 白名單含 `localhost:5173/5174` 與兩個正式 origin；用環境變數 `ALLOWED_ORIGINS` 管理。 |
| 8 | SEO / 既有書籤 | 使用者找不到入口 | P4 舊網址 301；公告與現場公佈新網址 + 加入主畫面教學。 |

---

## 8. 待確認決策

| # | 問題 | 選項 | 建議 |
|---|---|---|---|
| 1 | 使用者端主題 | (a) 改暖色**淺色**單一主題 (b) 沿用現有**深色**海軍藍 + 琥珀 (c) 淺色首發、深色模式 P2 後補 | **(c)** |
| 2 | 正式網域 | (a) `booking.` / `console.` / `api.` 子網域 (b) 兩個獨立網域 (c) 先用 Vercel 預設網域，P4 再綁 | (a)，P4 綁定 |
| 3 | 手機開後台 | (a) 完全擋、顯示提示頁 (b) 留「待審核快速核可」極簡清單 (c) 保留現有 `MobileAdminDashboard` | **(a)**；若總務有實需再做 (b) |
| 4 | `WeeklyBulletin` / `SpecialEventsPage` | (a) 整包放 `packages/shared` 當共用元件 (b) member / console 各自 fork 一份 (c) 只共用邏輯、view 各寫 | **(a)** 短期，P3 視情況轉 (c) |
| 5 | Vercel 專案 | (a) 三個獨立專案 (b) 一個專案三個 build target | **(a)** |
| 6 | monorepo 工具 | (a) 純 npm workspaces (b) 加 Turborepo | **(a)** |
| 7 | 中文字體 | (a) 加 `Noto Sans TC`（webfont，體積大）(b) 只靠系統中文字體 fallback | (b) 為主 + (a) 只補標題，或用 `font-display: swap` + subset |

---

## 附錄 A：現有檔案的歸屬對照表

> 「重畫」= 邏輯留、版面重做；「原封」= 幾乎照搬只改 import。

| 現有檔案 | 去處 | 處理 |
|---|---|---|
| `frontend/src/lib/types.ts` | `packages/shared/types.ts` | 原封 |
| `frontend/src/lib/api.ts` | `packages/shared/api.ts` | 原封 |
| `frontend/src/lib/supabase.ts` | `packages/shared/supabase.ts` | 原封 |
| `frontend/src/AuthContext.tsx`、`contexts/auth-context.ts`、`hooks/useAuth.ts` | `packages/shared/auth/` | 原封 |
| `frontend/src/lib/constants.ts` | `packages/shared/constants.ts` | 原封 |
| `frontend/src/lib/roomGrid.ts`、`lib/bookingConflicts.ts` | `packages/shared/domain/` | 原封 |
| `frontend/src/hooks/useBooking.ts`、`useProfile.ts`、`useIssueReport.ts`、`useOnlineStatus.ts` | `apps/member/src/features/` | 原封（member 專用） |
| `frontend/src/repositories/*`、`services/booking/*`、`services/pwa/*` | `apps/member/src/features/` | 原封 |
| `frontend/src/App.tsx` | 拆成 `apps/member/src/app/` 與 `apps/console/src/App.tsx` | 重寫（大幅瘦身，去 `adminMode`） |
| `frontend/src/Login.tsx` | `apps/member/src/screens/Login` | 重畫 |
| `frontend/src/pages/HomePage.tsx` | `apps/member/src/screens/Home` + `BranchSelect` | 重畫（拆兩頁、狀態列收斂） |
| `frontend/src/pages/BookingPage.tsx` | `apps/member/src/screens/Booking/*` | 重畫（2 步 → 6 單題精靈） |
| `frontend/src/pages/RecordsPage.tsx` | `apps/member/src/screens/Records` | 重畫（分段 + 詳情 sheet） |
| `frontend/src/pages/IssueReportPage.tsx`、`IssueHistoryPage.tsx` | `apps/member/src/screens/Issue*` | 重畫 |
| `frontend/src/pages/AnnouncementsPage.tsx` | `apps/member/src/screens/Announcements` | 重畫（sheet） |
| `frontend/src/pages/SpecialEventsPage.tsx` | `packages/shared`（共用元件）或 member/console 各自 | 見 §8-4；member 端重畫成手機時間軸 |
| `frontend/src/WeeklyBulletin.tsx` | `packages/shared`（共用元件） | member 端加「單日手機檢視」 |
| `frontend/src/FloorMap.tsx` | `apps/console/src/tabs/`（管理端多邊形編輯）；member 端唯讀圖 P2 後可選 | 主要留 console |
| `frontend/src/components/AppHeader.tsx` | member / console 各一份精簡版 | 重寫 |
| `frontend/src/components/ProfileModal.tsx` | `apps/member/src/screens/Profile`（sheet） | 重畫 |
| `frontend/src/components/CleanupModal.tsx`、`AssignCleaningModal.tsx`、`AdminInspectionModal.tsx` | Cleanup → member sheet；Assign / Inspection → console | 重畫 / 原封 |
| `frontend/src/components/StatusToast.tsx` | 兩邊各自的 `ui/Toast` | 演進 |
| `frontend/src/components/MobileAdminDashboard.tsx` (+ test) | — | **刪除**（§5.3） |
| `frontend/src/components/AdminModeSelector.tsx` | — | **刪除**（§5.3） |
| `frontend/src/AdminPanel.tsx` | `apps/console/src/layout/` + `App.tsx` | 重構（去手機分支、去深色殘影） |
| `frontend/src/SuperAdminPanel.tsx` | `apps/console/src/SuperAdmin/` | 原封 |
| `frontend/src/pages/admin/*`（10 支 Tab） | `apps/console/src/tabs/` | 原封（清深色殘影） |
| `frontend/tailwind.config.js` | member / console 各一份 | member 用 §4.4 token；console 去 indigo→琥珀 hack |
| `frontend/src/index.css` | member / console 各一份 | 拆補丁，落正規 token |
| `frontend/public/manifest.webmanifest`、`sw.js`、`sw/*` | `apps/member/public/` | manifest 重寫；SW 骨架沿用 |
| `frontend/public/maps/*`、`icons.svg`、`favicon.svg` | 依用途分到 member / console | 原封 |
| `demo/` | — | 無關，維持不動 |

## 附錄 B：關鍵程式位置索引

- 角色分流與 `adminMode`：[`App.tsx:44-59`](../frontend/src/App.tsx:44)、[`App.tsx:330-363`](../frontend/src/App.tsx:330)、[`App.tsx:372-418`](../frontend/src/App.tsx:372)
- 使用者端底部 nav：[`App.tsx:556-576`](../frontend/src/App.tsx:556)、`.mobile-app-nav` [`index.css:204-238`](../frontend/src/index.css:204)
- 後台側邊欄分組：[`AdminPanel.tsx:398-453`](../frontend/src/AdminPanel.tsx:398)
- 後台手機分支：[`AdminPanel.tsx:240-335`](../frontend/src/AdminPanel.tsx:240)
- Tailwind 色彩覆寫：[`tailwind.config.js:16-41`](../frontend/tailwind.config.js:16)
- 淺色 / 對比補丁：[`index.css:240-255`](../frontend/src/index.css:240)、[`index.css:303-390`](../frontend/src/index.css:303)
- 深色設計 token：[`index.css:5-69`](../frontend/src/index.css:5)
- Supabase OAuth redirect：[`AuthContext.tsx:70-78`](../frontend/src/AuthContext.tsx:70)
- 帳號角色來源：`GET /api/profiles/me` → `AuthContext.fetchUserRole` [`AuthContext.tsx:21-41`](../frontend/src/AuthContext.tsx:21)
- PWA 註冊 / 開發清理：[`PwaService.ts`](../frontend/src/services/pwa/PwaService.ts)
- SW 生命週期與 fetch 策略：[`sw.js`](../frontend/public/sw.js)、[`sw/config.js`](../frontend/public/sw/config.js)
- PWA 安全政策（預約 online-only）：[`PWA_ARCHITECTURE.md`](../frontend/docs/PWA_ARCHITECTURE.md)
- 預約流程：[`BookingPage.tsx`](../frontend/src/pages/BookingPage.tsx)、`useBooking` [`hooks/useBooking.ts`](../frontend/src/hooks/useBooking.ts)
- 部署設定：[`vercel.json`](../vercel.json)
- 後端 CORS：[`backend/index.js:23`](../backend/index.js:23)

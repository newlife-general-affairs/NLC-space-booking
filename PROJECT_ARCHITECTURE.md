# 空間租借系統 — 專案程式架構文件 (Project Architecture)

本專案是教會場地借用系統，整合**場地預約**、**Google 表單自動匯入**、**涂鴉（Tuya）智慧門鎖**、**清潔歸還稽核**與**違規停權**。前端是兩個 React + TypeScript 單頁應用（使用者端 PWA、後台控制台），共用一個 Node.js + Express 後端，資料庫與登入使用 Supabase。

```text
 會眾手機 ──→ apps/member（PWA）──┐
                                  ├──→ /api/* ── backend（Express）──→ Supabase（Postgres + Auth）
 同工電腦 ──→ apps/console ───────┘                  │                └→ Tuya 雲端（門鎖密碼）
                                                      └→ SMTP（Nodemailer 寄確認信／密碼）
 Google 表單 ─→ Apps Script ─→ POST /api/intake/form ─┘
```

前台與後台各頁面、導覽權限與完整 API 端點列表，見 [`docs/前後台網頁架構.md`](docs/前後台網頁架構.md)；本文件著重整體結構、後端流程與資料表。

---

## 📂 專案目錄結構 (Directory Structure)

```text
NLC-space-booking/
├── backend/                       # 後端 API（Express；不在 npm workspaces 內，依賴另外安裝）
│   ├── index.js                   # 伺服器入口：helmet、CORS、掛載所有 routes
│   ├── database.js                # Supabase client（service role）
│   ├── authMiddleware.js          # 驗證 Supabase JWT，從 user_roles 帶出角色與據點；requireRole()
│   ├── validators.js              # 白名單常數（角色、借用類型、據點…）與字串清理
│   ├── violationsStore.js         # 違規記點、動態逾時判定、牧區停權判定
│   ├── tuyaClient.js              # 涂鴉雲端 API：同步／刪除門鎖臨時密碼
│   ├── mailService.js             # Nodemailer：預約確認信、門鎖密碼信
│   ├── roomMatch.js               # 場地名稱模糊比對（表單匯入用）
│   ├── blocks/                    # 預約管線積木（Lego Block Pattern）
│   │   ├── BaseBlock.js           #   抽象基底
│   │   ├── BlockPipeline.js       #   依序執行積木、共用 context
│   │   ├── BookingError.js        #   帶 HTTP 狀態碼的業務錯誤
│   │   ├── InputValidationBlock.js
│   │   ├── TimingPolicyBlock.js
│   │   ├── SuspensionCheckBlock.js
│   │   ├── OverlapCheckBlock.js
│   │   ├── DbInsertBlock.js
│   │   └── EmailNotifyBlock.js
│   ├── intake/
│   │   └── formParser.js          # Google 表單答案 → 預約草稿（日期、時段、場地、用途）
│   ├── routes/
│   │   ├── bookings.js            # 預約：建立、使用者修改／取消、週看板、清潔歸還、門鎖密碼
│   │   ├── admin.js               # 管理端：預約審核與編輯、違規記點、表單匯入紀錄
│   │   ├── intake.js              # Google 表單匯入 webhook（X-Intake-Secret）
│   │   ├── rooms.js               # 場地 CRUD、平面圖座標
│   │   ├── publicSpaces.js        # 公共空間（打掃指派用）
│   │   ├── announcements.js       # 據點公告
│   │   ├── issues.js              # 故障回報（管理端）
│   │   ├── myIssues.js            # 故障回報（本人）
│   │   ├── profiles.js            # 個人資料（/api/profile、/api/profiles）
│   │   ├── users.js               # 使用者角色與據點管理
│   │   └── tuya.js                # 涂鴉 webhook、裝置狀態、遠端控制
│   ├── tests/                     # Jest：各積木、預約修改／取消路由、表單解析與匯入路由、郵件
│   └── test_*.js、query_*.js…     # 手動除錯用腳本，不屬於正式程式
│
├── packages/shared/               # @church/shared：兩個前端共用
│   └── src/
│       ├── api.ts                 #   所有後端 API 呼叫
│       ├── types.ts、constants.ts、supabase.ts
│       ├── auth/                  #   AuthProvider、useAuth（登入、角色、所屬據點）
│       ├── domain/                #   bookingConflicts、roomGrid（純邏輯）
│       └── components/            #   Login、WeeklyBulletin、SpecialEventsPage
│
├── apps/
│   ├── member/                    # 使用者端 PWA（React + TS + Vite；port 5173）
│   │   ├── public/                #   manifest、Service Worker
│   │   └── src/                   #   App、navigation、bookingRules、pages、components、hooks、
│   │                              #   features/pwa、services、repositories（IndexedDB 草稿）、ui
│   └── console/                   # 後台控制台（React + TS + Vite；port 5174）
│       ├── api/index.js           #   後台 Vercel 專案的 API 入口（載入 backend/index.js）
│       ├── vercel.json            #   後台 Vercel 專案設定
│       └── src/                   #   App、AdminPanel、navigation、FloorMap、SuperAdminPanel、
│                                  #   pages/admin、components、hooks、domain
│
├── migration/                     # Supabase SQL migration（001～024，依序手動執行）與 reset.sql
├── docs/                          # 設計報告、網頁架構、部署說明、apps-script/form-intake.gs
├── scripts/setup-git-hooks.js     # npm install 時安裝 git hook（保護 main／staging）
├── api/index.js                   # 前台 Vercel 專案的 API 入口（載入 backend/index.js）
├── vercel.json                    # 前台 Vercel 專案設定（member + API）
└── package.json                   # 根目錄 npm workspaces（packages/*、apps/*）與開發腳本
```

---

## ⚙️ 後端架構 (Backend)

### 1. 請求入口與權限

`backend/index.js` 套用 `helmet`、CORS 與 JSON body parser 後，把各 router 掛到 `/api/*`。需要登入的端點都經過 `authMiddleware`：

1. 以 Supabase 驗證 `Authorization: Bearer <JWT>`。
2. 從 `user_roles` 帶出 `role`（`user`／`admin`／`system_admin`／`inspector`）與 `branch`（所屬據點，`全` 代表全部據點）。
3. 管理端點再用 `requireRole([...])` 限制角色，並在路由內檢查據點。

`/api/intake/form` 不走使用者登入，改用 `X-Intake-Secret` header 比對環境變數 `FORM_INTAKE_SECRET`。

### 2. 預約管線（Lego Block Pipeline）

**新增預約（`POST /api/bookings`）** 由 `BlockPipeline` 依序執行 6 個積木，所有積木共用同一個 `context`：

```javascript
// backend/routes/bookings.js
pipeline
  .use(new InputValidationBlock())  // 1. 欄位清理、借用類型白名單、人數 > 0
  .use(new TimingPolicyBlock())     // 2. 15 分鐘單位、當月／下月（15 號起）、7 天前、至少 1 小時、各據點開放時段
  .use(new SuspensionCheckBlock())  // 3. 一般使用者的牧區是否停權
  .use(new OverlapCheckBlock())     // 4. 略過完全重複的送出；檢查與父子空間的時段衝突
  .use(new DbInsertBlock())         // 5. 批次寫入 bookings（status 預設 pending）
  .use(new EmailNotifyBlock());     // 6. 非同步寄送確認信
```

積木丟出 `BookingError` 時，路由回傳對應的 HTTP 狀態碼與訊息；其他錯誤回 500。

**使用者修改預約（`PUT /api/bookings/:id`）** 重用前四個積木：

- 只修改單一時段。
- 停權檢查只在換到別的月份時執行。
- `OverlapCheckBlock` 透過 `context.excludeBookingId` 排除這筆預約本身，避免和自己衝突。

通過驗證後，由路由自己更新該筆資料。

### 3. 預約生命週期

```text
新增（前台管線 / 表單匯入）
  └→ pending ──管理員核准──→ approved ──到借用時間──→ 使用 ──→ 使用者提交清潔 ──→ 查察員檢查 ──→ is_returned
        │                       │                                    └─ 退回 → 使用者複檢
        │                       └─ 同工在「門鎖密碼」頁發送密碼（access_code），同步到涂鴉門鎖並寄信
        └─ 管理員退回 → rejected（rejection_reason 記原因）
```

使用者在「我的 → 借用紀錄」可以直接修改或取消尚未開始的預約；一般使用者在借用日 7 天內不能線上操作。

| 動作 | 結果 |
|---|---|
| 修改已核准預約的日期、時段或場地 | 退回 `pending`，刪除門鎖密碼，依天數記「變更」違規 |
| 只改人數或用途 | 維持原狀態 |
| 取消 | 改為 `rejected`，`rejection_reason` 記 `使用者自行取消`（管理員代為取消則記 `管理員取消`）；已核准的預約依天數記「取消」違規，並刪除門鎖密碼 |

同工也可以在後台直接編輯預約（`PUT /api/admin/bookings/:id`）：改已核准預約的時間或場地時，一樣會記「變更」違規並清除門鎖密碼，但維持核准狀態，不退回審核。

### 4. Google 表單自動匯入

```text
Google 表單送出
  └→ 表單回應試算表的 Apps Script onFormSubmit（docs/apps-script/form-intake.gs）
      └→ POST /api/intake/form（X-Intake-Secret）
          ├→ 以 form_response_id 檢查是否重送 → 重送時直接回傳上次結果（冪等）
          ├→ intake/formParser.js：依表單類型解析出預約草稿
          ├→ roomMatch.js：場地名稱模糊比對到 rooms；比對不到改用「💒 由教會分配」並標記需人工確認
          ├→ 逐筆寫入 bookings（status = pending，不做衝突阻擋，交給後台審核）
          └→ 寫入 form_intake_log（原始 payload、建立的預約、needs_review、skipped）
```

表單上的「取消／異動」不會直接修改既有預約，而是寫入一筆 `booking_type = '取消或異動'` 的待審核申請，由同工人工處理。後台「表單匯入紀錄」頁可以查看並標記已處理（`resolved`）。細節見 [`docs/表單自動匯入-設計報告.md`](docs/表單自動匯入-設計報告.md)。

### 5. 違規與停權（`violationsStore.js`）

- **取消／變更：** 依距借用日的天數扣點。7 天以上 0 點（不記錄）、5–6 天 1 點、3–4 天 2 點、1–2 天 3 點、當天 4 點。
- **逾時未歸還：** 已核准的預約超過結束時間 1 小時仍未歸還，查詢時動態計為 `late_return` 違規。管理員處理後以 `violations` 表的實體紀錄為準。
- **手動記點：** 同工可在後台新增（`manual`），或撤銷（`is_cancelled`）。
- **停權：** 牧區在某月累計 **5 點以上或違規 2 次**，下個月不能新增預約（`SuspensionCheckBlock`）。

### 6. 涂鴉門鎖整合（`tuyaClient.js`、`routes/tuya.js`）

- **核發：** 預約核准後，同工在後台「門鎖密碼」頁發送（`POST /api/bookings/:id/send-password`）。系統產生 6 位數密碼，同步為門鎖的臨時密碼（有效期間對應借用時段），並寄信給借用人。`tuya_password_id` 記下涂鴉端的密碼 ID。
- **刪除：** 預約取消、改期或過期時，刪除涂鴉端的密碼。讀取預約的端點會順便清除已結束場地的密碼（`cleanExpiredPasscodes`）。
- **後台管理：** 後台「智慧裝置」頁可以查看門鎖、燈、冷氣狀態並遠端控制。

---

## 🖥️ 前端架構 (Frontend)

兩個前端都不使用 router 套件。前台用 state 切換分頁，後台用網址 hash 記錄頁面。登入狀態與 API 呼叫都來自 `@church/shared`。

| | 使用者端 `apps/member` | 後台控制台 `apps/console` |
|---|---|---|
| 對象 | 一般會眾（手機為主，可安裝成 PWA） | 同工：系統管理員、據點管理員、查察員 |
| 主要畫面 | 首頁（公告、牧區資格）／預約（步驟式表單）／檔期（週看板）／我的（借用紀錄：修改、取消、清潔歸還、故障回報） | 今日總覽、預約審核、表單匯入紀錄、週看板、婚禮與重要活動、平面地圖、清潔稽核、門鎖密碼、故障回報、違規記點、公告、場地、公共空間、智慧裝置、使用者角色 |
| 特色 | Service Worker 離線快取、IndexedDB 預約草稿、新版本提示 | 依角色顯示導覽（`navigation.ts`）、待辦徽章、衝突拖曳調整 |

各頁面樹、導覽權限表與資料來源見 [`docs/前後台網頁架構.md`](docs/前後台網頁架構.md)。

---

## 🗄️ 資料表 (Supabase DB Schema)

Schema 以 `migration/` 依序建立。後端使用 service role key 存取，RLS 不限制後端。

| 資料表 | 用途 | 主要欄位 |
|---|---|---|
| `rooms` | 場地 | `name`、`capacity`、`description`、`image_url`、`branch`、`parent_room_id`（父空間被借時子空間視為衝突）、`polygon_points`（平面圖區塊）、`tuya_device_id`／`tuya_light_id`／`tuya_ac_id`；`(name, branch)` 唯一 |
| `bookings` | 借用單 | `room_id`、`user_email`、`full_name`、`phone`、`pastoral_zone`、`booking_type`（一般借用／婚禮／重要／取消或異動）、`purpose`、`attendance_count`、`booking_date`、`start_time`、`end_time`、`status`（pending／approved／rejected）、`rejection_reason`、`access_code`、`tuya_password_id`、`cleaning_assignments`（打掃指派與檢查狀態）、`is_returned` |
| `user_roles` | 角色與據點 | `id`（auth 使用者）、`email`、`role`（enum：user／admin／system_admin／inspector）、`branch`（`全` = 全部據點）；註冊時由 trigger 自動建立 |
| `user_profiles` | 個人資料 | `full_name`、`phone`、`department`、`pastoral_zone`；註冊時由 trigger 自動建立 |
| `violations` | 牧區違規紀錄 | `booking_id`（預約刪除時設為 NULL，保留歷史）、`pastoral_zone`、`branch`、預約快照（日期、時段、場地、借用人）、`violation_type`（cancel／change／no_show／late_return／manual）、`points`、`reason`、`is_cancelled` |
| `public_spaces` | 公共空間（打掃指派用） | `name`、`branch`、`category`、`sort_order`、`tuya_light_id` |
| `announcements` | 公告 | `title`、`content`、`created_by`、`is_active` |
| `room_issues` | 故障回報 | `room_id`、`reported_by`、`description`、`status` |
| `form_intake_log` | 表單匯入稽核與冪等 | `form_response_id`（唯一）、`raw_payload`、`created_booking_ids`、`needs_review`、`skipped`、`error`、`resolved`／`resolved_at`／`resolved_by` |

---

## 🧪 測試與部署

- **測試：** 在 `backend/` 執行 `npx jest`，內容包含各積木、預約修改／取消路由、表單解析與匯入路由、郵件服務。前端以 `npm run build`（含 `tsc -b`）與 `npm run lint` 檢查。
- **部署：** 前台、後台各是一個 Vercel 專案，各自帶一份相同的後端 API（`api/index.js`、`apps/console/api/index.js`），只部署 `main`（Production）與 `staging`。設定與流程見 [`docs/deploy-vercel.md`](docs/deploy-vercel.md)。

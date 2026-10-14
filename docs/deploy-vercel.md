# Vercel 部署指南

前台（使用者端）與後台（管理後台）各是一個 Vercel 專案，兩個專案都包含一份相同的後端 API（`backend/`），各自有 Production（`main`）與 staging 兩個環境。

## 架構

| | 前台 `nlc-booking` | 後台 `nlc-booking-console` |
|---|---|---|
| Root Directory | `./`（repo 根目錄） | `apps/console` |
| 設定檔 | [`vercel.json`](../vercel.json) | [`apps/console/vercel.json`](../apps/console/vercel.json) |
| 網頁 | `apps/member` | `apps/console` |
| API 入口 | [`api/index.js`](../api/index.js) | [`apps/console/api/index.js`](../apps/console/api/index.js) |
| `main` → Production | `nlc-booking.vercel.app` | `nlc-space-booking-console.vercel.app` |
| `staging` → Preview | `nlc-booking-staging.vercel.app` | `nlc-space-booking-console-staging.vercel.app` |

* 兩個專案位於 Vercel 團隊 `newlife-general-affairs-projects`。後台專案名稱是 `nlc-booking-console`，但網域是 `nlc-space-booking-console.vercel.app`。
* 兩個 API 入口都只是載入 `backend/index.js`，網頁一律以同源的 `/api/*` 呼叫自己專案的 API，沒有跨專案轉發。
* 兩份 `vercel.json` 都設了 `ignoreCommand`：只有 `main`、`staging` 會部署，其他分支推上 GitHub 時 Vercel 會略過。
* 安裝、建置、輸出目錄都寫在 `vercel.json`，Vercel 後台的同名設定會被覆蓋，不需要改。

## 一、建立專案（兩個專案各做一次）

1. Vercel → **Add New… → Project** → 匯入 GitHub repo `newlife-general-affairs/NLC-space-booking`（第一次需授權 Vercel 存取該帳號的 repo）。
2. 依專案填寫：
   * **前台**：Project Name `nlc-booking`；Root Directory 保持 `./`；Framework Preset 選 **Other**。
   * **後台**：Project Name `nlc-booking-console`；Root Directory 選 `apps/console`；Framework Preset 選 **Vite**。
3. 展開 **Environment Variables**，先填 Production 用的變數（見「三、環境變數」），再按 **Deploy**。
4. 後台專案：到 **Settings → Build and Deployment → Root Directory**，確認「Include files outside the root directory in the Build Step」為開啟——後台的 API 需要打包 `apps/console` 外面的 `backend/`。
5. **Settings → Environments → Production**：確認 Branch Tracking 為 `main`（預設即是）。

## 二、staging 環境（兩個專案各做一次）

1. 確認 GitHub 上已有 `staging` 分支並推過一次，Vercel 會建立該分支的 Preview 部署。
2. **Settings → Domains → Add Domain**：輸入 staging 網域（例如 `nlc-booking-staging.vercel.app`），指定給 **Preview** 環境的 Git Branch `staging`。之後 `staging` 每次部署都會更新這個固定網址。
3. **Settings → Environment Variables**：新增 staging 專用變數時，Environment 只勾 **Preview**，並在 Git Branch 欄位選 `staging`。
4. 環境變數改了之後要到 **Deployments** 對最新的部署按 **Redeploy** 才會生效。

## 三、環境變數

兩個專案都要設定，Production 與 staging 分開設。表中「同正式」代表 staging 填同一個值（staging 與正式共用 Supabase）。

| 變數 | Production（`main`） | staging | 說明 |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase 專案網址 | 同正式 | 前端用，建置時寫入網頁 |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | 同正式 | 前端用，建置時寫入網頁 |
| `SUPABASE_URL` | Supabase 專案網址 | 同正式 | 後端用 |
| `SUPABASE_ANON_KEY` | Supabase anon key | 同正式 | 後端用 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key（`sb_secret_…`）或 legacy `service_role` | 同正式 | 未設定時後端改用 anon key，部分個人資料與角色查詢可能被 RLS 擋下 |
| `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS` | 寄信帳號 | 同正式 | |
| `MAIL_ENABLED` | `true`（或不設） | **`false`** | `false` 時不寄信、只記 log |
| `TUYA_CLIENT_ID`、`TUYA_CLIENT_SECRET`、`TUYA_BASE_URL` | Tuya 憑證 | 同正式 | |
| `TUYA_ENABLED` | `true`（或不設） | **`false`** | `false` 時不連線 Tuya、不動實體門鎖 |
| `ALLOWED_ORIGINS` | 該專案的正式網域，例如 `https://nlc-booking.vercel.app` | 不設 | 有設時只接受列出的網域呼叫 API。瀏覽器送出表單時也會檢查，所以**一定要包含專案自己的網域**；staging 會經由多個預覽網址存取，不設比較不會被擋 |
| `FORM_INTAKE_SECRET` | 一組隨機字串 | 不設 | 只有前台需要（Google 表單匯入打前台）。不設時匯入 API 會拒絕所有請求 |
| `FORM_INTAKE_EMAIL`、`FORM_INTAKE_DEFAULT_BRANCH`、`FORM_INTAKE_YEAR` | 依需要 | 不設 | 只有前台需要，未設定時用預設值（見 `.env.example`） |

`PORT` 在 Vercel 上不需要設定。

**Supabase 整合**：團隊裝了 Supabase 的 Vercel 整合，它只在**前台 Production** 自動提供 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`（以及程式用不到的 `POSTGRES_*`、`NEXT_PUBLIC_*` 等）。那三個變數在前台 Production 不要再手動新增；後台兩個環境與前台 staging 則是手動設定。

## 四、Supabase（共用一套，設定一次）

**Authentication → URL Configuration**：

* **Site URL**：前台正式網域 `https://nlc-booking.vercel.app`
* **Redirect URLs**：加入四個網域，Google 登入後才能導回原本的網站：
  ```
  https://nlc-booking.vercel.app/**
  https://nlc-space-booking-console.vercel.app/**
  https://nlc-booking-staging.vercel.app/**
  https://nlc-space-booking-console-staging.vercel.app/**
  ```

Google Cloud 的 OAuth 用戶端是導回 Supabase，不需要改。

## 五、Google 表單匯入

Apps Script（[`docs/apps-script/form-intake.gs`](apps-script/form-intake.gs)）的 `ENDPOINT` 改為 `https://nlc-booking.vercel.app/api/intake/form`；Script Properties 的 `INTAKE_SECRET` 填前台 Production 的 `FORM_INTAKE_SECRET`。

## 六、Deployment Protection

staging 屬於 Preview 環境，Vercel 預設可能要求登入 Vercel 才能瀏覽（**Settings → Deployment Protection → Vercel Authentication**）。要讓沒有 Vercel 帳號的人測試 staging，需調整這個設定；正式網域不受影響。

## 七、共用資料庫的注意事項

staging 與正式共用同一個 Supabase，staging 上新增、修改、刪除的資料都會直接出現在正式環境：

* 測試預約的名稱標註「測試」，用完刪除；挑不會影響真實預約的日期與場地。
* staging 一定要設 `MAIL_ENABLED=false`、`TUYA_ENABLED=false`，避免寄信給真實使用者或改動實體門鎖密碼。
* 需要完全隔離時，再另開 staging 專用的 Supabase 專案，並把 staging 的 Supabase 變數換成新專案的值。

## 八、部署後檢查

- [ ] 前台、後台的 staging 網址都打得開，Google 登入後會導回 staging 網址
- [ ] 後台 staging：瀏覽器開發者工具的 Network 中，`/api/*` 請求打在後台 staging 自己的網域
- [ ] staging 建立測試預約後沒有收到信，Vercel 的 Functions log 出現 `[mail] MAIL_ENABLED=false`
- [ ] 推一個工作分支到 GitHub，Vercel 顯示該部署被略過（Ignored Build Step）
- [ ] 後台專案若建置或執行時找不到 `backend/` 的套件，檢查第一節第 4 步的設定

## 日常部署流程

* 工作分支 PR 合併到 `staging` → 兩個專案的 staging 自動部署。
* `staging` → `main` 的 PR 合併 → 兩個專案的 Production 自動部署。
* **兩種 PR 都要由負責人（`newlife-general-affairs`）在 GitHub 上以「Create a merge commit」合併。** Vercel 免費方案只部署團隊成員的 commit；分支最新的 commit 若是其他帳號的，部署會顯示 BLOCKED。
* 只改後端時兩個專案也都會重新部署，因為兩邊都帶同一份後端。

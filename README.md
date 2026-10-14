# 💒 場地空間預約與智慧門鎖管理系統 (Space Booking & Smart Lock System)

教會多據點的場地預約、審核與現場管理系統。前端分為會眾使用的 **使用者端（member，可安裝的 PWA）** 與同工使用的 **管理後台（console）**，後端為 Express + Supabase，並整合 Tuya 智慧門鎖。

---

## 🧩 系統組成

| 目錄 | 說明 | 本機網址 |
|---|---|---|
| `apps/member` | 使用者端：預約、查檔期、借用紀錄 | http://localhost:5173 |
| `apps/console` | 管理後台：審核、檔期、現場管理、設定 | http://localhost:5174 |
| `packages/shared` | 共用程式 `@church/shared`：登入、API、週看板、婚禮與重要活動 | — |
| `backend` | Express API：預約管線、Tuya、Email、試算表匯入 | http://localhost:3001 |

前端以 npm workspaces 管理（`apps/*`、`packages/*`）；`backend` 不在 workspace 內，相依套件另外安裝。

---

## 📱 使用者端（member）

底部導覽共四個分頁：

| 分頁 | 內容 |
|---|---|
| **首頁** | 據點公告、所屬牧區的借用資格與違規點數、借用規則 |
| **預約** | 新增借用申請；「取消或異動」既有預約 |
| **檔期** | 共用週曆，可看各場地檔期與婚禮／重要活動，點空檔直接開始預約 |
| **我的** | 個人資料、切換據點、借用紀錄；從借用紀錄進行場地歸還檢查與故障回報 |

### 預約規則（由後端預約管線強制執行）
* 只開放預約當月與下個月，每月 15 日起開放下個月；婚禮與重要活動不受此限。
* 一般會眾新增或異動借用，需在使用日 7 天前申請。
* 與既有借用時段重疊會被擋下；主空間與其子空間視為同一場地檢查。
* 各據點有開放時段限制（例如週日 06:30–17:30）。
* 牧區上個月累計扣滿 5 點或違規 2 次，次月暫停該牧區所有人的借用資格。

---

## 🖥️ 管理後台（console）

桌機為左側導覽、手機為底部導覽，分為六大類，項目依角色顯示：

| 分類 | 頁面 | 說明 |
|---|---|---|
| 總覽 | 今日總覽 | 待審核、有衝突、待分配打掃、待清潔檢查、未處理故障等待辦數字，以及今日借用 |
| 預約 | 預約審核 | 待審核／有衝突／審核通過／已過期；可為「由教會分配」的申請指派實際場地，衝突可拖曳調整 |
| | 表單匯入紀錄 | Google 表單經 Apps Script 自動匯入的申請紀錄 |
| | 試算表匯入 | 貼上公開的 Google 試算表網址，覆蓋匯入整季排表；有衝突的時段自動改為待審核 |
| 檔期 | 週看板 | 各場地一週檔期 |
| | 婚禮與重要活動 | 檢視與編輯婚禮、重要活動 |
| | 平面地圖 | SVG 平面圖以燈號顯示各空間目前使用狀況，可編輯場地區塊座標 |
| 現場 | 清潔稽核 | 待分配打掃 → 已分配打掃 → 待清潔檢查 → 已歸還／打掃記錄 |
| | 門鎖密碼 | 產生、重新產生 Tuya 智慧鎖臨時密碼並同步到門鎖，寄送或重寄通知信 |
| | 故障回報 | 處理場地故障；同工也可直接在此回報 |
| 會員 | 違規記點 | 記錄違規與扣點，作為牧區停權依據 |
| | 公告 | 發布各據點公告 |
| 設定 | 場地配置 | 場地與主子空間設定 |
| | 公共空間 | 公共空間設定 |
| | 智慧裝置 | 即時監控與控制 Tuya 裝置 |
| | 使用者角色 | 調整帳號角色與所屬據點 |

導覽與權限統一定義在 [`apps/console/src/navigation.ts`](apps/console/src/navigation.ts)。

### 角色與權限

| 角色 | 顯示名稱 | 可用範圍 |
|---|---|---|
| `system_admin` | 系統管理員 | 後台全部頁面、所有據點 |
| `admin` | 據點管理員 | 「使用者角色」以外的全部頁面；被指派單一據點者固定在該據點 |
| `inspector` | 查察員 | 今日總覽、清潔稽核、故障回報（可回報，不能變更處理狀態） |
| `user` | 一般會眾 | 只能使用使用者端 |

---

## 🛠️ 技術棧

* **前端**：React 19、TypeScript、Vite 7、Tailwind CSS 3、Lucide Icons；member 另用 React Router、Framer Motion
* **後端**：Express (Node.js)、Supabase（資料庫與登入）、Nodemailer、xlsx
* **外部整合**：Tuya IoT 智慧鎖、Google 試算表、Google 表單（Apps Script）

---

## ⚡ 本機開發

### 1. 安裝相依套件
```bash
npm run install:all
```

### 2. 環境變數
複製根目錄的 `.env.example` 為 `.env` 並填入實際值。後端與兩個前端都讀取根目錄的 `.env`：

* 後端：`PORT`、`ALLOWED_ORIGINS`、`SMTP_*`、`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`TUYA_*`
* 前端：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（Vite 只讀取 `VITE_` 開頭的變數）

### 3. 啟動
```bash
npm start
```
同時啟動後端與兩個前端，網址見上方「系統組成」。

### 常用指令

| 指令 | 用途 |
|---|---|
| `npm run dev:member` / `dev:console` / `dev:backend` | 個別啟動 |
| `npm run build` | 建置兩個前端（含型別檢查）；也可用 `build:member` / `build:console` |
| `npm run lint` | 檢查兩個前端 |
| `cd backend && npm test` | 後端單元測試（Jest） |

### 分支流程

```
工作分支 ──PR──▶ staging（測試）──PR──▶ main（正式）
```

* 每項改動先開 issue，再從 `main` 開工作分支來做。
* 工作分支開 PR 合併到 `staging` 測試；確認 OK 後，從 `staging` 開 PR 到 `main`，**由負責人在 GitHub 上看完說明後手動合併**。
* `staging` 是長期分支，**不可刪除**（合併 PR 時不要勾選刪除分支）。

repo 目前無法使用 GitHub 的分支保護，改由 [`.githooks/pre-push`](.githooks/pre-push) 在本機擋下以下操作：直接 push 到 `main`、刪除 `staging`、對 `staging` force push。`npm install` 會自動啟用這個 hook（[`scripts/setup-git-hooks.js`](scripts/setup-git-hooks.js)）；只 clone 沒有安裝相依套件的話，可以手動執行 `git config core.hooksPath .githooks`。

---

## 🚀 部署

使用者端與管理後台是兩個 Vercel 專案，各自包含一份相同的後端 API，並各有 Production（`main`）與 staging 環境。

* 根目錄 [`vercel.json`](vercel.json)：使用者端＋後端 API
* [`apps/console/vercel.json`](apps/console/vercel.json)：管理後台＋後端 API

建立專案、環境變數、staging 網域等設定步驟見 [`docs/deploy-vercel.md`](docs/deploy-vercel.md)。

---

## 📚 相關文件

* [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md)：目錄結構、後端預約管線、資料庫
* [`docs/deploy-vercel.md`](docs/deploy-vercel.md)：Vercel 部署指南
* [`docs/前後台拆分與使用者端PWA重構-設計報告.md`](docs/前後台拆分與使用者端PWA重構-設計報告.md)
* [`docs/衝突拖曳調整-設計報告.md`](docs/衝突拖曳調整-設計報告.md)
* [`docs/表單自動匯入-設計報告.md`](docs/表單自動匯入-設計報告.md)（Apps Script：[`docs/apps-script/form-intake.gs`](docs/apps-script/form-intake.gs)）
* [`apps/member/docs/PWA_ARCHITECTURE.md`](apps/member/docs/PWA_ARCHITECTURE.md)

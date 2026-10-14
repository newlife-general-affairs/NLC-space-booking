// 後台 Vercel 專案的後端 API：沿用 repo 根目錄的 backend/（與前台專案部署同一份程式）。
// 所有 /api/* 由 vercel.json 轉到這支函式，Express 依原始路徑分派。
import app from '../../../backend/index.js';

export default app;

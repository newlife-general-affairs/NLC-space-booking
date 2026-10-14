// 前台 Vercel 專案的後端 API：所有 /api/* 由 vercel.json 轉到這支函式，Express 依原始路徑分派。
module.exports = require('../backend/index.js');

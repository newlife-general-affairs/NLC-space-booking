import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  alert('【系統錯誤】找不到 Supabase 環境變數！\n如果您在本地端，請確認 frontend 裡面有 .env.local 檔案。\n如果您在 Vercel，請確認有設定 Environment Variables！');
  throw new Error('Missing Supabase env variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

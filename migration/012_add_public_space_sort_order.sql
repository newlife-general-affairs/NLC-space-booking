-- 新增 sort_order 欄位至 public_spaces 資料表，預設值為 0
ALTER TABLE public.public_spaces ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0 NOT NULL;

-- 新增 category 欄位至 public_spaces 資料表，預設值為 '空間'
ALTER TABLE public.public_spaces ADD COLUMN IF NOT EXISTS category TEXT DEFAULT '空間' NOT NULL;

-- 依據現有預設公共空間的名稱進行智慧自動分類為：廁所、空間、垃圾桶
UPDATE public.public_spaces SET category = '空間';
UPDATE public.public_spaces SET category = '廁所' WHERE name LIKE '%洗手間%' OR name LIKE '%廁所%' OR name LIKE '%男廁%' OR name LIKE '%女廁%' OR name LIKE '%無障礙%';
UPDATE public.public_spaces SET category = '垃圾桶' WHERE name LIKE '%垃圾%';

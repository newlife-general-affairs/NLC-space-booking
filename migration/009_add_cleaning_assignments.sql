-- 增加打掃指派欄位
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS cleaning_assignments TEXT;

-- 欄位註解說明
COMMENT ON COLUMN public.bookings.cleaning_assignments IS '指派打掃的公共空間，多個以逗號或 JSON 分隔';

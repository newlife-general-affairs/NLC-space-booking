-- 在 public_spaces 表新增智慧電燈裝置 ID
ALTER TABLE public.public_spaces 
ADD COLUMN IF NOT EXISTS tuya_light_id TEXT;

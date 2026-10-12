-- 新增智慧電燈與冷氣控制相關欄位

-- 1. 在 rooms 表新增智慧電燈裝置 ID
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS tuya_light_id TEXT;

-- 2. 在 rooms 表新增智慧冷氣裝置 ID
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS tuya_ac_id TEXT;

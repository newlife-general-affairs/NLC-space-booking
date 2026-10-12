-- 新增智慧鎖相關欄位

-- 1. 在 rooms 表新增智慧鎖裝置 ID
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS tuya_device_id TEXT;

-- 2. 在 bookings 表新增已同步的門鎖密碼 ID
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS tuya_password_id TEXT;

-- 新增牧區欄位至 user_profiles 表中
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS pastoral_zone TEXT;

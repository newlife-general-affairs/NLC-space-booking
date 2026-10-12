-- 擴充預約資料表欄位
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS pastoral_zone TEXT,
ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT '一般借用',
ADD COLUMN IF NOT EXISTS purpose TEXT,
ADD COLUMN IF NOT EXISTS attendance_count INTEGER;

-- 更新註釋
COMMENT ON COLUMN public.bookings.full_name IS '借用人姓名';
COMMENT ON COLUMN public.bookings.phone IS '聯絡電話';
COMMENT ON COLUMN public.bookings.pastoral_zone IS '所屬牧區';
COMMENT ON COLUMN public.bookings.booking_type IS '借用類型：一般借用、婚禮、重要';
COMMENT ON COLUMN public.bookings.purpose IS '單位及性質';
COMMENT ON COLUMN public.bookings.attendance_count IS '預計人數';

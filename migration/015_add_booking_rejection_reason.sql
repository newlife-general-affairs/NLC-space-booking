-- 新增場地預約申請「拒絕原因」欄位
-- 當管理員拒絕預約時，必須填寫拒絕原因，儲存於此欄位以供借用人查閱

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN public.bookings.rejection_reason IS '管理員拒絕預約申請時填寫的原因說明；核可時自動清除為 NULL';

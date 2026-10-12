-- 新增預約狀態欄位
ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- 更新現有預約為已核可 (避免現有資料消失)
UPDATE bookings SET status = 'approved' WHERE status IS NULL OR status = 'pending';

-- 建立狀態索引
CREATE INDEX idx_bookings_status ON bookings(status);

-- 將違規紀錄從本地 violations.json 遷移至 Supabase 資料表
-- 此資料表取代後端伺服器上的 violations.json 檔案，確保資料持久性與可靠性

CREATE TABLE IF NOT EXISTS public.violations (
  booking_id    BIGINT      PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  reason        TEXT        NOT NULL DEFAULT '未完整復歸場地',
  is_cancelled  BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.violations IS '手動記錄或取消的預約違規覆蓋資料（系統自動超時違規不在此表，由程式即時判斷）';
COMMENT ON COLUMN public.violations.booking_id   IS '對應的預約 ID（外鍵）';
COMMENT ON COLUMN public.violations.reason       IS '違規原因說明';
COMMENT ON COLUMN public.violations.is_cancelled IS 'TRUE 表示此違規已被管理員取消（僅適用於超時型）';
COMMENT ON COLUMN public.violations.updated_at   IS '最後更新時間';

-- 建立索引方便依 booking_id 查詢
CREATE INDEX IF NOT EXISTS violations_booking_id_idx ON public.violations(booking_id);

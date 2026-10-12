-- 將 violations 表重新定義以支援牧區扣點機制與保留刪除後的預約違規歷史紀錄
DROP TABLE IF EXISTS public.violations;

CREATE TABLE public.violations (
  id            BIGSERIAL   PRIMARY KEY,
  booking_id    BIGINT      REFERENCES public.bookings(id) ON DELETE SET NULL,
  pastoral_zone TEXT        NOT NULL,
  booking_date  DATE        NOT NULL,
  start_time    TEXT,
  end_time      TEXT,
  room_name     TEXT,
  branch        TEXT        NOT NULL,
  full_name     TEXT,
  phone         TEXT,
  user_email    TEXT,
  purpose       TEXT,
  violation_type TEXT       NOT NULL DEFAULT 'manual', -- 'change', 'cancel', 'no_show', 'late_return', 'manual'
  points        INTEGER     NOT NULL DEFAULT 0,
  reason        TEXT        NOT NULL DEFAULT '未完整復歸場地',
  is_cancelled  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立相關索引以提高查詢效能
CREATE INDEX IF NOT EXISTS violations_booking_id_idx ON public.violations(booking_id);
CREATE INDEX IF NOT EXISTS violations_pastoral_zone_idx ON public.violations(pastoral_zone);
CREATE INDEX IF NOT EXISTS violations_branch_idx ON public.violations(branch);

COMMENT ON TABLE public.violations IS '牧區違規扣點與歷史紀錄資料表';
COMMENT ON COLUMN public.violations.booking_id IS '關聯的預約 ID（預約刪除時設為 NULL 以保留違規歷史）';
COMMENT ON COLUMN public.violations.pastoral_zone IS '所屬牧區名稱';
COMMENT ON COLUMN public.violations.booking_date IS '原借用日期';
COMMENT ON COLUMN public.violations.violation_type IS '違規類型：cancel (取消), change (變更), no_show (未到/租借未使用), late_return (未完整復歸/逾期), manual (手動)';
COMMENT ON COLUMN public.violations.points IS '扣除點數';
COMMENT ON COLUMN public.violations.reason IS '違規原因描述';
COMMENT ON COLUMN public.violations.is_cancelled IS '是否已被管理員撤銷/赦免';

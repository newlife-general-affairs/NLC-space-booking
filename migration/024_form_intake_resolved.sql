-- 024_form_intake_resolved.sql
-- form_intake_log 加上「已處理」狀態，供後台「表單匯入紀錄」分頁人工審核用。

ALTER TABLE public.form_intake_log
  ADD COLUMN IF NOT EXISTS resolved     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by  TEXT;

COMMENT ON COLUMN public.form_intake_log.resolved IS '管理員是否已人工審核/處理過這筆表單提交';

CREATE INDEX IF NOT EXISTS idx_form_intake_log_unresolved
  ON public.form_intake_log (received_at DESC)
  WHERE resolved = FALSE;

-- 1. 新增場地名稱與據點的唯一約束，防止資料庫端產生重複資料
ALTER TABLE public.rooms 
ADD CONSTRAINT rooms_name_branch_key UNIQUE (name, branch);

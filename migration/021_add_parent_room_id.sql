-- 1. 在 rooms 資料表中新增 parent_room_id 欄位，連結至 rooms(id)
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS parent_room_id BIGINT REFERENCES public.rooms(id) ON DELETE SET NULL;

-- 2. 建立索引以優化查詢效能
CREATE INDEX IF NOT EXISTS idx_rooms_parent_room_id ON public.rooms(parent_room_id);

-- 3. 動態插入「B2-第五教室-前」與「B2-第五教室-後」子場地
DO $$
DECLARE
  v_parent_id BIGINT;
BEGIN
  -- 尋找現有的「B2-第五教室」
  SELECT id INTO v_parent_id FROM public.rooms WHERE name = 'B2-第五教室' AND branch = '仁愛堂';
  
  -- 如果有找到，且尚未建立子場地，則進行新增
  IF v_parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE name = 'B2-第五教室-前' AND branch = '仁愛堂') THEN
      INSERT INTO public.rooms (name, capacity, description, branch, parent_room_id)
      VALUES ('B2-第五教室-前', 10, 'B2-第五教室的前半部空間', '仁愛堂', v_parent_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE name = 'B2-第五教室-後' AND branch = '仁愛堂') THEN
      INSERT INTO public.rooms (name, capacity, description, branch, parent_room_id)
      VALUES ('B2-第五教室-後', 10, 'B2-第五教室的後半部空間', '仁愛堂', v_parent_id);
    END IF;
  END IF;
END $$;

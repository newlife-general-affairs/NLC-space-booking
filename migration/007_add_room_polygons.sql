-- Add polygon_points column to rooms table to support dynamic floor map rendering
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS polygon_points TEXT;

-- Update existing rooms with hardcoded coordinates as defaults
-- B1F Rooms
UPDATE public.rooms SET polygon_points = 'B1F:175,180 445,180 445,890 175,890' WHERE name = 'B1-主會堂' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B1F:525,825 730,825 730,920 525,920' WHERE name = 'B1-副堂' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B1F:350,55 530,55 530,135 350,135' WHERE name = 'B1-第一區塊' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B1F:530,140 680,140 680,310 530,310' WHERE name = 'B1-第二區塊' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B1F:550,315 690,315 690,450 550,450' WHERE name = 'B1-第三區塊' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B1F:590,455 745,455 745,615 590,615' WHERE name = 'B1-第四區塊' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B1F:615,620 780,620 780,750 615,750' WHERE name = 'B1-第五區塊' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B1F:760,760 920,760 920,930 760,930' WHERE name = 'B1-第六區塊' AND branch = '仁愛堂';

-- B2F Rooms
UPDATE public.rooms SET polygon_points = 'B2F:195,145 425,145 425,300 195,300' WHERE name = 'B2-第五教室' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B2F:200,430 420,430 420,555 200,555' WHERE name = 'B2-第六教室' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B2F:205,730 320,730 320,885 205,885' WHERE name = 'B2-第一教室' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B2F:325,730 420,730 420,885 325,885' WHERE name = 'B2-第二教室' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B2F:425,730 545,730 545,885 425,885' WHERE name = 'B2-第三教室' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B2F:550,730 670,730 670,885 550,885' WHERE name = 'B2-第四教室' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B2F:670,430 840,430 840,555 670,555' WHERE name = 'B2-五教外' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B2F:670,555 845,555 845,695 670,695' WHERE name = 'B2-豆腐區' AND branch = '仁愛堂';
UPDATE public.rooms SET polygon_points = 'B2F:670,695 850,695 850,885 670,885' WHERE name = 'B2-廚房前' AND branch = '仁愛堂';

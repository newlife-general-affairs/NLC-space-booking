-- 為每個據點新增一個虛擬場地「💒 由教會分配」，讓使用者可以選擇不指定場地
INSERT INTO public.rooms (name, capacity, description, branch, image_url) VALUES 
('💒 由教會分配', 0, '不指定場地，後續將由管理員為您安排最適合的空間', '仁愛堂', 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80'),
('💒 由教會分配', 0, '不指定場地，後續將由管理員為您安排最適合的空間', '士林堂', 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80'),
('💒 由教會分配', 0, '不指定場地，後續將由管理員為您安排最適合的空間', '新莊', 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80'),
('💒 由教會分配', 0, '不指定場地，後續將由管理員為您安排最適合的空間', '大福', 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80');


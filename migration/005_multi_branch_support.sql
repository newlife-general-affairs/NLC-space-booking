-- 新增據點資訊至場地表
ALTER TABLE rooms ADD COLUMN branch TEXT DEFAULT '仁愛堂';

-- 新增據點資訊至使用者角色表，用於權限控管
ALTER TABLE user_roles ADD COLUMN branch TEXT;

-- 更新現有場地，預設全部歸類為仁愛堂
UPDATE rooms SET branch = '仁愛堂';

-- 建立據點索引
CREATE INDEX idx_rooms_branch ON rooms(branch);
CREATE INDEX idx_user_roles_branch ON user_roles(branch);

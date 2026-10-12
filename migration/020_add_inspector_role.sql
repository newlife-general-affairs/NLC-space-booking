-- Add 'inspector' to the user_role enum type to allow setting clean inspectors
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'inspector';

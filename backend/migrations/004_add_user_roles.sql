ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role ENUM('user', 'admin') NOT NULL DEFAULT 'user' AFTER deleted_at;

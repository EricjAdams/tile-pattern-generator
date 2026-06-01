ALTER TABLE users
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER created_at;

CREATE INDEX idx_users_deleted_at ON users (deleted_at);

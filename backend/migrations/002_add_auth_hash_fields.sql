ALTER TABLE users
  ADD COLUMN username_normalized VARCHAR(100) NULL AFTER username,
  ADD COLUMN email_normalized VARCHAR(255) NULL AFTER email,
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER password;

ALTER TABLE users
  MODIFY COLUMN password VARCHAR(255) NULL DEFAULT NULL;

UPDATE users
SET
  username_normalized = LOWER(username),
  email_normalized = LOWER(email)
WHERE username_normalized IS NULL
   OR email_normalized IS NULL;

ALTER TABLE users
  ADD UNIQUE KEY unique_users_username_normalized (username_normalized),
  ADD UNIQUE KEY unique_users_email_normalized (email_normalized);

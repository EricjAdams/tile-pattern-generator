CREATE TABLE tiles (
  id INT NOT NULL AUTO_INCREMENT,
  userId INT NOT NULL,
  tileKey VARCHAR(160) NOT NULL,
  name VARCHAR(255) NOT NULL,
  imageUrl VARCHAR(1000) NOT NULL,
  storageKey VARCHAR(1000) NOT NULL,
  originalFilename VARCHAR(255) NULL,
  mimeType VARCHAR(100) NOT NULL,
  sizeBytes INT NOT NULL,
  width INT NULL,
  height INT NULL,
  source ENUM('uploaded') NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_tile_key (userId, tileKey),
  KEY idx_tiles_user_deleted_created (userId, deleted_at, created_at),
  KEY idx_tiles_user_id_deleted (userId, id, deleted_at),
  CONSTRAINT fk_tiles_user
    FOREIGN KEY (userId)
    REFERENCES users(id)
    ON DELETE CASCADE
);

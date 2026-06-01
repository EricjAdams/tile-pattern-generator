const db = require('./db');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const BCRYPT_COST = 12;
const GENERIC_LOGIN_ERROR = 'Invalid username/email or password';
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{5,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPLOAD_ROOT = path.join(__dirname, 'uploads');
const TILE_UPLOAD_ROOT = path.join(UPLOAD_ROOT, 'tiles');
const MAX_TILE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_TILE_UPLOAD_FILES = 20;
const ALLOWED_TILE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const TILE_EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_ROOT));

const tileUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      const userId = String(req.params.userId || '').replace(/[^0-9]/g, '');
      const uploadDir = path.join(TILE_UPLOAD_ROOT, `user-${userId || 'unknown'}`);

      fs.mkdir(uploadDir, { recursive: true }, (err) => {
        callback(err, uploadDir);
      });
    },
    filename(req, file, callback) {
      const extension = TILE_EXTENSION_BY_MIME_TYPE[file.mimetype] || '';
      callback(null, `${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: MAX_TILE_UPLOAD_BYTES,
    files: MAX_TILE_UPLOAD_FILES,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_TILE_MIME_TYPES.has(file.mimetype)) {
      return callback(new Error('Only JPG, PNG, and WebP tile images are supported.'));
    }

    callback(null, true);
  },
});

function normalizeLayoutData(layoutData) {
  if (typeof layoutData === 'string') {
    return JSON.parse(layoutData);
  }

  return layoutData;
}

function isValidLayoutPayload(layout) {
  return (
    Array.isArray(layout) ||
    (typeof layout === 'object' &&
      layout !== null &&
      Array.isArray(layout.cells))
  );
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateUsername(username) {
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 5-30 characters and use only letters, numbers, underscores, or hyphens.';
  }

  return null;
}

function validateEmail(email) {
  if (!EMAIL_PATTERN.test(email)) {
    return 'Enter a valid email address.';
  }

  return null;
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be 8-128 characters.';
  }

  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return 'Password must include uppercase, lowercase, number, and symbol characters.';
  }

  return null;
}

function getSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

async function isValidUserPassword(user, password) {
  if (user.password_hash) {
    return bcrypt.compare(password, user.password_hash);
  }

  return Boolean(user.password && user.password === password);
}

function normalizeTileRow(tile) {
  return {
    id: tile.id,
    userId: tile.userId,
    tileKey: tile.tileKey,
    key: tile.tileKey,
    name: tile.name,
    imageUrl: tile.imageUrl,
    image: tile.imageUrl,
    storageKey: tile.storageKey,
    originalFilename: tile.originalFilename,
    mimeType: tile.mimeType,
    sizeBytes: tile.sizeBytes,
    source: tile.source,
    created_at: tile.created_at,
  };
}

function getTileNameFromFilename(filename) {
  const safeFilename = path.basename(String(filename || 'Uploaded tile'));
  return safeFilename.replace(/\.[^/.]+$/, '') || 'Uploaded tile';
}

function getStorageKeyForUploadedFile(file) {
  return path
    .relative(UPLOAD_ROOT, file.path)
    .split(path.sep)
    .join('/');
}

function removeUploadedFiles(files) {
  files.forEach((file) => {
    fs.unlink(file.path, (err) => {
      if (err) {
        console.error('Uploaded file cleanup failed:', err);
      }
    });
  });
}

function findDuplicateLayoutName(userId, name, excludedLayoutId, callback) {
  const trimmedName = String(name || '').trim();
  const params = [userId, trimmedName];
  let query = `
    SELECT id
    FROM layouts
    WHERE userId = ?
      AND LOWER(TRIM(name)) = LOWER(?)
  `;

  if (excludedLayoutId !== null && excludedLayoutId !== undefined) {
    query += ' AND id <> ?';
    params.push(excludedLayoutId);
  }

  query += ' LIMIT 1';

  db.query(query, params, callback);
}

function handleLegacyLogin(identifier, password, res) {
  const query = `
    SELECT id, username, email
    FROM users
    WHERE (email = ? OR username = ?)
      AND password = ?
      AND deleted_at IS NULL
    LIMIT 1
  `;

  db.query(query, [identifier, identifier, password], (err, results) => {
    if (err) {
      console.error('Login failed:', err);
      return res.status(500).json({ error: 'Login failed' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    res.json(getSafeUser(results[0]));
  });
}

app.get('/', (req, res) => {
  res.send('Tile Pattern Generator backend is running!');
});

// REGISTER user
app.post('/register', async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  const usernameNormalized = username.toLowerCase();
  const emailNormalized = email;

  const usernameError = validateUsername(username);
  if (usernameError) {
    return res.status(400).json({ error: usernameError });
  }

  const emailError = validateEmail(email);
  if (emailError) {
    return res.status(400).json({ error: emailError });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const duplicateQuery = `
    SELECT username_normalized, email_normalized
    FROM users
    WHERE username_normalized = ?
       OR email_normalized = ?
    LIMIT 1
  `;

  db.query(duplicateQuery, [usernameNormalized, emailNormalized], async (duplicateErr, duplicateResults) => {
    if (duplicateErr) {
      console.error('Registration duplicate check failed:', duplicateErr);
      return res.status(500).json({ error: 'Registration failed' });
    }

    if (duplicateResults.length > 0) {
      const duplicate = duplicateResults[0];

      if (duplicate.username_normalized === usernameNormalized) {
        return res.status(409).json({ error: 'Username is already taken.' });
      }

      return res.status(409).json({ error: 'Email is already registered.' });
    }

    let passwordHash;

    try {
      passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    } catch (hashErr) {
      console.error('Password hash failed:', hashErr);
      return res.status(500).json({ error: 'Registration failed' });
    }

    const insertQuery = `
      INSERT INTO users (
        username,
        username_normalized,
        email,
        email_normalized,
        password_hash
      )
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
      insertQuery,
      [username, usernameNormalized, email, emailNormalized, passwordHash],
      (insertErr, result) => {
        if (insertErr) {
          if (insertErr.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username or email is already registered.' });
          }

          console.error('Registration insert failed:', insertErr);
          return res.status(500).json({ error: 'Registration failed' });
        }

        res.status(201).json({
          id: result.insertId,
          username,
          email,
        });
      },
    );
  });
});

// LOGIN user
app.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: GENERIC_LOGIN_ERROR });
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);

  const query = `
    SELECT id, username, email, password, password_hash, deleted_at
    FROM users
    WHERE (username_normalized = ?
       OR email_normalized = ?)
      AND deleted_at IS NULL
    LIMIT 1
  `;

  db.query(query, [normalizedIdentifier, normalizedIdentifier], async (err, results) => {
    if (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        return handleLegacyLogin(identifier, password, res);
      }

      console.error('Login failed:', err);
      return res.status(500).json({ error: 'Login failed' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }

    const user = results[0];

    try {
      if (user.password_hash) {
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
          return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
        }

        return res.json(getSafeUser(user));
      }

      if (user.password && user.password === password) {
        const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
        const migrationQuery = `
          UPDATE users
          SET password_hash = ?
          WHERE id = ?
        `;

        db.query(migrationQuery, [passwordHash, user.id], (migrationErr) => {
          if (migrationErr) {
            console.error('Legacy password migration failed:', migrationErr);
            return res.status(500).json({ error: 'Login failed' });
          }

          return res.json(getSafeUser(user));
        });

        return;
      }

      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    } catch (loginErr) {
      console.error('Login failed:', loginErr);
      return res.status(500).json({ error: 'Login failed' });
    }
  });
});

// SOFT DELETE user account
app.delete('/users/:userId', (req, res) => {
  const { userId } = req.params;
  const { password, confirmation } = req.body;

  if (!/^\d+$/.test(String(userId))) {
    return res.status(400).json({ error: 'Valid user id is required.' });
  }

  if (!password || confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'Password and DELETE confirmation are required.' });
  }

  const query = `
    SELECT id, username, email, password, password_hash
    FROM users
    WHERE id = ?
      AND deleted_at IS NULL
    LIMIT 1
  `;

  db.query(query, [userId], async (err, results) => {
    if (err) {
      console.error('Account deletion lookup failed:', err);
      return res.status(500).json({ error: 'Account deletion failed' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    try {
      const user = results[0];
      const isValidPassword = await isValidUserPassword(user, password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Password confirmation failed.' });
      }

      const deleteQuery = `
        UPDATE users
        SET deleted_at = NOW()
        WHERE id = ?
          AND deleted_at IS NULL
      `;

      db.query(deleteQuery, [userId], (deleteErr, result) => {
        if (deleteErr) {
          console.error('Account deletion failed:', deleteErr);
          return res.status(500).json({ error: 'Account deletion failed' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Account not found' });
        }

        res.json({ message: 'Account deleted successfully' });
      });
    } catch (deleteErr) {
      console.error('Account deletion failed:', deleteErr);
      return res.status(500).json({ error: 'Account deletion failed' });
    }
  });
});

// READ uploaded tiles for one user
app.get('/users/:userId/tiles', (req, res) => {
  const { userId } = req.params;

  if (!/^\d+$/.test(String(userId))) {
    return res.status(400).json({ error: 'Valid user id is required.' });
  }

  const query = `
    SELECT
      id,
      userId,
      tileKey,
      name,
      imageUrl,
      storageKey,
      originalFilename,
      mimeType,
      sizeBytes,
      source,
      created_at
    FROM tiles
    WHERE userId = ?
      AND deleted_at IS NULL
    ORDER BY created_at ASC, id ASC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Tile fetch failed:', err);
      return res.status(500).json({ error: 'Tile fetch failed' });
    }

    res.json(results.map(normalizeTileRow));
  });
});

// CREATE uploaded tiles for one user
app.post('/users/:userId/tiles', (req, res) => {
  const { userId } = req.params;

  if (!/^\d+$/.test(String(userId))) {
    return res.status(400).json({ error: 'Valid user id is required.' });
  }

  tileUpload.array('tileImages', MAX_TILE_UPLOAD_FILES)(req, res, (uploadErr) => {
    if (uploadErr) {
      removeUploadedFiles(Array.isArray(req.files) ? req.files : []);
      const status = uploadErr instanceof multer.MulterError ? 400 : 415;
      return res.status(status).json({ error: uploadErr.message });
    }

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'At least one tile image is required.' });
    }

    const uploadedTiles = uploadedFiles.map((file) => {
      const storageKey = getStorageKeyForUploadedFile(file);
      const imageUrl = `/uploads/${storageKey}`;

      return {
        userId,
        tileKey: `uploaded:${userId}:${crypto.randomUUID()}`,
        name: getTileNameFromFilename(file.originalname),
        imageUrl,
        storageKey,
        originalFilename: path.basename(file.originalname || ''),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        source: 'uploaded',
      };
    });

    const query = `
      INSERT INTO tiles (
        userId,
        tileKey,
        name,
        imageUrl,
        storageKey,
        originalFilename,
        mimeType,
        sizeBytes,
        source
      )
      VALUES ?
    `;
    const values = uploadedTiles.map((tile) => [
      tile.userId,
      tile.tileKey,
      tile.name,
      tile.imageUrl,
      tile.storageKey,
      tile.originalFilename,
      tile.mimeType,
      tile.sizeBytes,
      tile.source,
    ]);

    db.query(query, [values], (err, result) => {
      if (err) {
        removeUploadedFiles(uploadedFiles);
        console.error('Tile insert failed:', err);
        return res.status(500).json({ error: 'Tile upload failed' });
      }

      const createdTiles = uploadedTiles.map((tile, index) =>
        normalizeTileRow({
          ...tile,
          id: result.insertId + index,
          created_at: new Date(),
        }),
      );

      res.status(201).json(createdTiles);
    });
  });
});

// SEARCH + READ all layouts for one user
app.get('/users/:userId/layouts', (req, res) => {
  const { userId } = req.params;
  const search = req.query.search || '';

  const query = `
    SELECT id, userId, name, layout
    FROM layouts
    WHERE userId = ?
      AND name LIKE ?
    ORDER BY id DESC
  `;

  db.query(query, [userId, `%${search}%`], (err, results) => {
    if (err) {
      console.error('Database fetch failed:', err);
      return res.status(500).json({ error: 'Database fetch failed' });
    }

    const layouts = results.map((item) => ({
      id: item.id,
      userId: item.userId,
      name: item.name,
      layout: normalizeLayoutData(item.layout),
    }));

    res.json(layouts);
  });
});

// CREATE layout
app.post('/users/:userId/layouts', (req, res) => {
  const { userId } = req.params;
  const { name, layout } = req.body;
  const trimmedName = String(name || '').trim();

  console.log('CREATE LAYOUT REQUEST', { userId, name: trimmedName, layoutType: typeof layout });

  if (!trimmedName || !isValidLayoutPayload(layout)) {
    return res.status(400).json({ error: 'Name and layout data are required' });
  }

  findDuplicateLayoutName(userId, trimmedName, null, (duplicateErr, duplicateResults) => {
    if (duplicateErr) {
      console.error('Layout duplicate check failed:', duplicateErr);
      return res.status(500).json({ error: 'Layout duplicate check failed' });
    }

    if (duplicateResults.length > 0) {
      return res.status(409).json({ error: 'A layout with this name already exists.' });
    }

    const query = `
      INSERT INTO layouts (userId, name, layout)
      VALUES (?, ?, ?)
    `;

    db.query(query, [userId, trimmedName, JSON.stringify(layout)], (err, result) => {
      if (err) {
        console.error('Database insert failed:', err, { userId, name: trimmedName, layout });
        return res.status(500).json({ error: 'Database insert failed' });
      }

      res.status(201).json({
        message: 'Layout created successfully',
        id: result.insertId,
      });
    });
  });
});

// UPDATE layout for one user
app.put('/users/:userId/layouts/:id', (req, res) => {
  const { userId, id } = req.params;
  const { name, layout } = req.body;
  const trimmedName = String(name || '').trim();

  if (!trimmedName || !isValidLayoutPayload(layout)) {
    return res.status(400).json({ error: 'Name and layout data are required' });
  }

  findDuplicateLayoutName(userId, trimmedName, id, (duplicateErr, duplicateResults) => {
    if (duplicateErr) {
      console.error('Layout duplicate check failed:', duplicateErr);
      return res.status(500).json({ error: 'Layout duplicate check failed' });
    }

    if (duplicateResults.length > 0) {
      return res.status(409).json({ error: 'A layout with this name already exists.' });
    }

    const query = `
      UPDATE layouts
      SET name = ?, layout = ?
      WHERE id = ?
        AND userId = ?
    `;

    db.query(query, [trimmedName, JSON.stringify(layout), id, userId], (err, result) => {
      if (err) {
        console.error('Database update failed:', err);
        return res.status(500).json({ error: 'Database update failed' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Layout not found' });
      }

      res.json({ message: 'Layout updated successfully' });
    });
  });
});

// DELETE layout for one user
app.delete('/users/:userId/layouts/:id', (req, res) => {
  const { userId, id } = req.params;

  const query = `
    DELETE FROM layouts
    WHERE id = ?
      AND userId = ?
  `;

  db.query(query, [id, userId], (err, result) => {
    if (err) {
      console.error('Database delete failed:', err);
      return res.status(500).json({ error: 'Database delete failed' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    res.json({ message: 'Layout deleted successfully' });
  });
});

// READ one layout
app.get('/layouts/:id', (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT id, userId, name, layout
    FROM layouts
    WHERE id = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Database fetch failed:', err);
      return res.status(500).json({ error: 'Database fetch failed' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    const item = results[0];

    res.json({
      id: item.id,
      userId: item.userId,
      name: item.name,
      layout: normalizeLayoutData(item.layout),
    });
  });
});

// UPDATE layout
app.put('/layouts/:id', (req, res) => {
  const { id } = req.params;
  const { name, layout } = req.body;
  const trimmedName = String(name || '').trim();

  if (!trimmedName || !isValidLayoutPayload(layout)) {
    return res.status(400).json({ error: 'Name and layout data are required' });
  }

  const ownerQuery = `
    SELECT userId
    FROM layouts
    WHERE id = ?
  `;

  db.query(ownerQuery, [id], (ownerErr, ownerResults) => {
    if (ownerErr) {
      console.error('Database fetch failed:', ownerErr);
      return res.status(500).json({ error: 'Database fetch failed' });
    }

    if (ownerResults.length === 0) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    const userId = ownerResults[0].userId;

    findDuplicateLayoutName(userId, trimmedName, id, (duplicateErr, duplicateResults) => {
      if (duplicateErr) {
        console.error('Layout duplicate check failed:', duplicateErr);
        return res.status(500).json({ error: 'Layout duplicate check failed' });
      }

      if (duplicateResults.length > 0) {
        return res.status(409).json({ error: 'A layout with this name already exists.' });
      }

      const query = `
        UPDATE layouts
        SET name = ?, layout = ?
        WHERE id = ?
      `;

      db.query(query, [trimmedName, JSON.stringify(layout), id], (err, result) => {
        if (err) {
          console.error('Database update failed:', err);
          return res.status(500).json({ error: 'Database update failed' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Layout not found' });
        }

        res.json({ message: 'Layout updated successfully' });
      });
    });
  });
});

// DELETE layout
app.delete('/layouts/:id', (req, res) => {
  const { id } = req.params;

  const query = 'DELETE FROM layouts WHERE id = ?';

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Database delete failed:', err);
      return res.status(500).json({ error: 'Database delete failed' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    res.json({ message: 'Layout deleted successfully' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

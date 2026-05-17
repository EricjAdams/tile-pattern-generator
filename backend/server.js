const db = require('./db');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Helper to handle JSON strings vs Objects from MySQL
function normalizeLayoutData(layoutData) {
  if (!layoutData) return [];
  if (typeof layoutData === 'string') {
    try {
      return JSON.parse(layoutData);
    } catch (e) {
      console.error("JSON Parse Error", e);
      return [];
    }
  }
  return layoutData;
}

app.get('/', (req, res) => {
  res.send('Tile Pattern Generator backend is running!');
});

// ===== AUTHENTICATION ENDPOINTS =====

// REGISTER: Create a new user
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  // Check if user already exists
  const checkQuery = 'SELECT id FROM users WHERE email = ? OR username = ?';
  db.query(checkQuery, [email, username], (err, results) => {
    if (err) {
      console.error('Database check failed:', err);
      return res.status(500).json({ error: 'Database check failed' });
    }

    if (results.length > 0) {
      return res.status(409).json({ error: 'User with that email or username already exists' });
    }

    // Insert new user
    const insertQuery = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    db.query(insertQuery, [username, email, password], (err, result) => {
      if (err) {
        console.error('User creation failed:', err);
        return res.status(500).json({ error: 'User creation failed' });
      }

      res.status(201).json({
        id: result.insertId,
        username: username,
        email: email,
      });
    });
  });
});

// LOGIN: Authenticate a user
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const query = 'SELECT id, username, email, password FROM users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('Database query failed:', err);
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = results[0];

    // Plain text password comparison (simple class demo)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  });
});

// ===== LAYOUT ENDPOINTS =====

// 1. GET ALL LAYOUTS FOR A USER
app.get('/users/:userId/layouts', (req, res) => {
  const { userId } = req.params;
  const search = req.query.search || '';

  const query = `
    SELECT id, userId, name, layout 
    FROM layouts
    WHERE userId = ? AND name LIKE ?
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

// 2. CREATE NEW LAYOUT
app.post('/layouts', (req, res) => {
  const { userId, name, layout } = req.body;

  if (!name || !layout) {
    return res.status(400).json({ error: 'Name and layout are required' });
  }

  const query = `INSERT INTO layouts (userId, name, layout) VALUES (?, ?, ?)`;

  db.query(query, [userId, name, JSON.stringify(layout)], (err, result) => {
    if (err) {
      console.error('Database insert failed:', err);
      return res.status(500).json({ error: 'Database insert failed' });
    }
    res.status(201).json({ message: 'Layout created successfully', id: result.insertId });
  });
});

// 3. UPDATE LAYOUT
app.put('/layouts/:id', (req, res) => {
  const { id } = req.params;
  const { name, layout } = req.body;

  const query = `UPDATE layouts SET name = ?, layout = ? WHERE id = ?`;

  db.query(query, [name, JSON.stringify(layout), id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Update failed' });
    res.json({ message: 'Updated successfully' });
  });
});

// 4. DELETE LAYOUT
app.delete('/layouts/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM layouts WHERE id = ?';

  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Delete failed' });
    res.json({ message: 'Deleted successfully' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
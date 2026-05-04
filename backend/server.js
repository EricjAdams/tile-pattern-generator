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

// 1. GET ALL LAYOUTS (Matches TilePreview fetch)
app.get('/users/:userId/layouts', (req, res) => {
  const { userId } = req.params;
  const search = req.query.search || '';

  // Check column names: using userId and layout based on your error logs
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

// 2. CREATE LAYOUT (Matches App.jsx fetch)
// Important: Matches 'http://localhost:3001/layouts' called by App.jsx
app.post('/layouts', (req, res) => {
  const { userId, name, layout } = req.body;

  if (!name || !layout) {
    return res.status(400).json({ error: 'Name and layout are required' });
  }

  const query = `INSERT INTO layouts (userId, name, layout) VALUES (?, ?, ?)`;

  // We stringify the layout object for MySQL TEXT/JSON columns
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
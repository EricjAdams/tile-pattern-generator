const db = require('./db');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

function normalizeLayoutData(layoutData) {
  if (typeof layoutData === 'string') {
    return JSON.parse(layoutData);
  }

  return layoutData;
}

app.get('/', (req, res) => {
  res.send('Tile Pattern Generator backend is running!');
});

// SEARCH + READ all layouts for one user
app.get('/users/:userId/layouts', (req, res) => {
  const { userId } = req.params;
  const search = req.query.search || '';

  const query = `
    SELECT id, user_id, name, layout_data, created_at, updated_at
    FROM layouts
    WHERE user_id = ?
      AND name LIKE ?
    ORDER BY updated_at DESC, id DESC
  `;

  db.query(query, [userId, `%${search}%`], (err, results) => {
    if (err) {
      console.error('Database fetch failed:', err);
      return res.status(500).json({ error: 'Database fetch failed' });
    }

    const layouts = results.map((item) => ({
      id: item.id,
      userId: item.user_id,
      name: item.name,
      layout: normalizeLayoutData(item.layout_data),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    res.json(layouts);
  });
});

// CREATE layout
// Accepts a layout name and layout object for a specific user and persists it to the database
app.post('/users/:userId/layouts', (req, res) => {
  const { userId } = req.params;
  const { name, layout } = req.body;

  // Validate that both name and layout data are provided
  if (!name || !layout) {
    return res.status(400).json({ error: 'Name and layout are required' });
  }

  // Insert the layout into the database, storing layout as JSON
  const query = `
    INSERT INTO layouts (user_id, name, layout_data)
    VALUES (?, ?, ?)
  `;

  db.query(query, [userId, name, JSON.stringify(layout)], (err, result) => {
    // Handle database errors
    if (err) {
      console.error('Database insert failed:', err);
      return res.status(500).json({ error: 'Database insert failed' });
    }

    // Return 201 Created with the new layout's ID
    res.status(201).json({
      message: 'Layout created successfully',
      id: result.insertId,
    });
  });
});

// READ one layout
app.get('/layouts/:id', (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT id, user_id, name, layout_data, created_at, updated_at
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
      userId: item.user_id,
      name: item.name,
      layout: normalizeLayoutData(item.layout_data),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    });
  });
});

// UPDATE layout
app.put('/layouts/:id', (req, res) => {
  const { id } = req.params;
  const { name, layout } = req.body;

  if (!name || !layout) {
    return res.status(400).json({ error: 'Name and layout are required' });
  }

  const query = `
    UPDATE layouts
    SET name = ?, layout_data = ?
    WHERE id = ?
  `;

  db.query(query, [name, JSON.stringify(layout), id], (err, result) => {
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
# Tile Pattern Generator - User System Implementation Guide

## 1. SQL SETUP

Run these SQL commands in your MySQL terminal:

```sql
-- Create users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verify layouts table structure (should already exist)
DESC layouts;
-- Expected columns: id, userId, name, layout
```

**To execute in terminal:**

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p'password123' --ssl-mode=DISABLED tile_pattern_generator
```

Then paste the CREATE TABLE statement and press Enter.

---

## 2. BACKEND (server.js)

**File Location:** `/Users/ericadams/Desktop/PatternGenerator/backend/server.js`

**Replace the entire file with:**

```javascript
const db = require("./db");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Helper to handle JSON strings vs Objects from MySQL
function normalizeLayoutData(layoutData) {
  if (!layoutData) return [];
  if (typeof layoutData === "string") {
    try {
      return JSON.parse(layoutData);
    } catch (e) {
      console.error("JSON Parse Error", e);
      return [];
    }
  }
  return layoutData;
}

app.get("/", (req, res) => {
  res.send("Tile Pattern Generator backend is running!");
});

// ===== AUTHENTICATION ENDPOINTS =====

// REGISTER: Create a new user
app.post("/register", (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email, and password are required" });
  }

  // Check if user already exists
  const checkQuery = "SELECT id FROM users WHERE email = ? OR username = ?";
  db.query(checkQuery, [email, username], (err, results) => {
    if (err) {
      console.error("Database check failed:", err);
      return res.status(500).json({ error: "Database check failed" });
    }

    if (results.length > 0) {
      return res
        .status(409)
        .json({ error: "User with that email or username already exists" });
    }

    // Insert new user
    const insertQuery =
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
    db.query(insertQuery, [username, email, password], (err, result) => {
      if (err) {
        console.error("User creation failed:", err);
        return res.status(500).json({ error: "User creation failed" });
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
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const query =
    "SELECT id, username, email, password FROM users WHERE email = ?";
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error("Database query failed:", err);
      return res.status(500).json({ error: "Database query failed" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = results[0];

    // Plain text password comparison (simple class demo)
    if (user.password !== password) {
      return res.status(401).json({ error: "Invalid password" });
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
app.get("/users/:userId/layouts", (req, res) => {
  const { userId } = req.params;
  const search = req.query.search || "";

  const query = `
    SELECT id, userId, name, layout 
    FROM layouts
    WHERE userId = ? AND name LIKE ?
    ORDER BY id DESC
  `;

  db.query(query, [userId, `%${search}%`], (err, results) => {
    if (err) {
      console.error("Database fetch failed:", err);
      return res.status(500).json({ error: "Database fetch failed" });
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
app.post("/layouts", (req, res) => {
  const { userId, name, layout } = req.body;

  if (!name || !layout) {
    return res.status(400).json({ error: "Name and layout are required" });
  }

  const query = `INSERT INTO layouts (userId, name, layout) VALUES (?, ?, ?)`;

  db.query(query, [userId, name, JSON.stringify(layout)], (err, result) => {
    if (err) {
      console.error("Database insert failed:", err);
      return res.status(500).json({ error: "Database insert failed" });
    }
    res
      .status(201)
      .json({ message: "Layout created successfully", id: result.insertId });
  });
});

// 3. UPDATE LAYOUT
app.put("/layouts/:id", (req, res) => {
  const { id } = req.params;
  const { name, layout } = req.body;

  const query = `UPDATE layouts SET name = ?, layout = ? WHERE id = ?`;

  db.query(query, [name, JSON.stringify(layout), id], (err, result) => {
    if (err) return res.status(500).json({ error: "Update failed" });
    res.json({ message: "Updated successfully" });
  });
});

// 4. DELETE LAYOUT
app.delete("/layouts/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM layouts WHERE id = ?";

  db.query(query, [id], (err, result) => {
    if (err) return res.status(500).json({ error: "Delete failed" });
    res.json({ message: "Deleted successfully" });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

---

## 3. FRONTEND (App.jsx)

**File Location:** `/Users/ericadams/Desktop/PatternGenerator/frontend/src/App.jsx`

**Replace the entire file with:**

```jsx
import { useState, useEffect } from "react";
import "./App.css";
import TilePreview from "./TilePreview";

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const API_BASE_URL = "http://localhost:3001";

  // Load user from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("loggedInUser");
    if (saved) {
      try {
        setLoggedInUser(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved user:", e);
      }
    }
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || "Registration failed");
        setAuthLoading(false);
        return;
      }

      // Registration successful, auto-login
      setLoggedInUser(data);
      localStorage.setItem("loggedInUser", JSON.stringify(data));
      setEmail("");
      setPassword("");
      setUsername("");
      setAuthMode("login");
    } catch (error) {
      setAuthError("Network error: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || "Login failed");
        setAuthLoading(false);
        return;
      }

      // Login successful
      setLoggedInUser(data);
      localStorage.setItem("loggedInUser", JSON.stringify(data));
      setEmail("");
      setPassword("");
      setUsername("");
    } catch (error) {
      setAuthError("Network error: " + error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    localStorage.removeItem("loggedInUser");
    setEmail("");
    setPassword("");
    setUsername("");
    setAuthError("");
  };

  const saveLayout = async (layout, name) => {
    try {
      const response = await fetch(`${API_BASE_URL}/layouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: loggedInUser.id,
          name: name,
          layout: JSON.stringify(layout),
        }),
      });

      if (!response.ok) throw new Error("Database rejected the save");

      const data = await response.json();
      console.log("Save successful:", data);
      return true;
    } catch (error) {
      console.error("Save error:", error);
      return false;
    }
  };

  if (!loggedInUser) {
    return (
      <div className="app-container">
        <div className="auth-container">
          <div className="auth-card">
            <h1>Tile Pattern Generator</h1>

            {authMode === "login" ? (
              <form onSubmit={handleLogin}>
                <h2>Log In</h2>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={authLoading}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={authLoading}
                />
                {authError && <p className="auth-error">{authError}</p>}
                <button type="submit" disabled={authLoading}>
                  {authLoading ? "Logging in..." : "Log In"}
                </button>
                <p>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError("");
                    }}
                  >
                    Create one
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <h2>Register</h2>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={authLoading}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={authLoading}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={authLoading}
                />
                {authError && <p className="auth-error">{authError}</p>}
                <button type="submit" disabled={authLoading}>
                  {authLoading ? "Creating account..." : "Register"}
                </button>
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                  >
                    Log in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-shell">
        <div className="app-header">
          <h1>Tile Pattern Generator</h1>
          <div className="user-info">
            <span>👤 {loggedInUser.username}</span>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
        <TilePreview onSaveLayout={saveLayout} loggedInUser={loggedInUser} />
      </div>
      <footer className="footer">
        Created by Eric Adams • Tile Pattern Generator Prototype
      </footer>
    </div>
  );
}

export default App;
```

---

## 4. FRONTEND (TilePreview.jsx)

**File Location:** `/Users/ericadams/Desktop/PatternGenerator/frontend/src/TilePreview.jsx`

**Replace the entire file with:**

```jsx
import { useEffect, useRef, useState } from "react";
import TileComponent from "./TileComponent";
import initialTiles from "./data/tiles";
import initialLayout, { createLayout } from "./data/layout";

const API_BASE_URL = "http://localhost:3001";
const MAX_ROWS = 30;
const MAX_COLUMNS = 30;

function clampGridCount(value, max) {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), max);
}

function calculateGridCount(surfaceSize, tileSize, groutSize, max) {
  const effectiveTileSize = Number(tileSize) + Number(groutSize);
  if (effectiveTileSize <= 0) return 1;
  return clampGridCount(Number(surfaceSize) / effectiveTileSize, max);
}

function inferGridColumns(layoutData) {
  const squareRoot = Math.sqrt(layoutData.length);
  return Number.isInteger(squareRoot) ? squareRoot : 11;
}

function TilePreview({ onSaveLayout, loggedInUser }) {
  const [tiles, setTiles] = useState(initialTiles);
  const [layout, setLayout] = useState(initialLayout);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [lastClickedCellId, setLastClickedCellId] = useState(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [wallWidth, setWallWidth] = useState(60);
  const [wallHeight, setWallHeight] = useState(60);
  const [tileWidth, setTileWidth] = useState(6);
  const [tileHeight, setTileHeight] = useState(6);
  const [groutSize, setGroutSize] = useState(0.25);
  const [gridColumns, setGridColumns] = useState(9);
  const [gridRows, setGridRows] = useState(9);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [layoutName, setLayoutName] = useState("New Tile Design");
  const [selectedSavedLayoutId, setSelectedSavedLayoutId] = useState(null);

  const fileInputRef = useRef(null);
  const paintRotationRef = useRef(0);
  const gridRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  const calculatedColumns = calculateGridCount(
    wallWidth,
    tileWidth,
    groutSize,
    MAX_COLUMNS,
  );
  const calculatedRows = calculateGridCount(
    wallHeight,
    tileHeight,
    groutSize,
    MAX_ROWS,
  );
  const totalTiles = gridRows * gridColumns;

  useEffect(() => {
    const handleGlobalUp = () => {
      setIsPointerDown(false);
      clearInterval(scrollIntervalRef.current);
    };
    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, []);

  useEffect(() => {
    fetchSavedLayouts();
  }, [loggedInUser]);

  const handleAutoScroll = (e) => {
    if (!isPointerDown || !gridRef.current) return;
    const grid = gridRef.current;
    const rect = grid.getBoundingClientRect();
    const threshold = 60;
    const scrollSpeed = 15;
    clearInterval(scrollIntervalRef.current);
    if (e.clientY < rect.top + threshold) {
      scrollIntervalRef.current = setInterval(() => {
        grid.scrollTop -= scrollSpeed;
      }, 20);
    } else if (e.clientY > rect.bottom - threshold) {
      scrollIntervalRef.current = setInterval(() => {
        grid.scrollTop += scrollSpeed;
      }, 20);
    }
  };

  async function fetchSavedLayouts(searchValue = "") {
    if (!loggedInUser) {
      setSavedLayouts([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${loggedInUser.id}/layouts?search=${encodeURIComponent(searchValue)}`,
      );
      if (response.ok) {
        const data = await response.json();
        setSavedLayouts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      setSavedLayouts([]);
    }
  }

  function handleApplyWallDimensions() {
    setGridRows(calculatedRows);
    setGridColumns(calculatedColumns);
    setLayout(createLayout(calculatedRows, calculatedColumns));
    setSelectedSavedLayoutId(null);
    setSelectedTileId(null);
    setStatusMessage(`Grid updated to ${calculatedRows}x${calculatedColumns}.`);
  }

  function applyTileToCell(clickedId, tileId) {
    const rot = paintRotationRef.current;
    setLayout((prev) =>
      prev.map((c) =>
        c.id === clickedId ? { ...c, tileId, rotation: rot } : c,
      ),
    );
  }

  function rotateCell(clickedId) {
    setLayout((prev) =>
      prev.map((c) =>
        c.id === clickedId ? { ...c, rotation: (c.rotation + 90) % 360 } : c,
      ),
    );
  }

  function handleGridPointerDown(clickedId) {
    setIsPointerDown(true);
    if (selectedTileId !== null) {
      if (lastClickedCellId === clickedId) {
        rotateCell(clickedId);
        setSelectedTileId(null);
        return;
      }
      applyTileToCell(clickedId, selectedTileId);
      setLastClickedCellId(clickedId);
    } else {
      rotateCell(clickedId);
    }
  }

  function handleGridPointerEnter(clickedId, e) {
    if (
      !isPointerDown ||
      selectedTileId === null ||
      lastClickedCellId === clickedId
    )
      return;
    applyTileToCell(clickedId, selectedTileId);
    setLastClickedCellId(clickedId);
    handleAutoScroll(e);
  }

  function handleLibraryTileClick(tileId) {
    paintRotationRef.current = 0;
    setSelectedTileId((prev) => (prev === tileId ? null : tileId));
    setLastClickedCellId(null);
  }

  function handleResetLayout() {
    setLayout(createLayout(gridRows, gridColumns));
    setSelectedTileId(null);
    setSelectedSavedLayoutId(null);
    setLayoutName("New Tile Design");
    setStatusMessage("Layout reset.");
  }

  function handleLoadSavedLayout(sl) {
    try {
      const loaded =
        typeof sl.layout === "string" ? JSON.parse(sl.layout) : sl.layout;
      const cols = inferGridColumns(loaded);
      setLayout(loaded);
      setGridColumns(cols);
      setGridRows(Math.ceil(loaded.length / cols));
      setLayoutName(sl.name);
      setSelectedSavedLayoutId(sl.id);
      setSelectedTileId(null);
      setStatusMessage(`Loaded "${sl.name}".`);
    } catch (e) {
      console.error(e);
      setStatusMessage("Error: Could not load layout.");
    }
  }

  async function handleCreateLayout() {
    if (!loggedInUser) {
      setStatusMessage("Please log in to save layouts.");
      return;
    }
    try {
      const nameToSave = layoutName.trim() || "Untitled Layout";
      const success = await onSaveLayout(layout, nameToSave);
      if (success) {
        await fetchSavedLayouts(searchTerm);
        setStatusMessage(`Successfully saved "${nameToSave}"!`);
      }
    } catch (err) {
      setStatusMessage("Error saving layout.");
    }
  }

  async function handleUpdateLayout() {
    if (!selectedSavedLayoutId)
      return setStatusMessage("Select a layout first.");
    const nameToUpdate = layoutName.trim() || "Untitled Layout";
    const res = await fetch(
      `${API_BASE_URL}/layouts/${selectedSavedLayoutId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameToUpdate, layout }),
      },
    );
    if (res.ok) {
      await fetchSavedLayouts(searchTerm);
      setStatusMessage(`Updated "${nameToUpdate}".`);
    }
  }

  async function handleDeleteLayout(id) {
    try {
      const res = await fetch(`${API_BASE_URL}/layouts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedSavedLayoutId === id) handleResetLayout();
        await fetchSavedLayouts(searchTerm);
        setStatusMessage("Layout deleted.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="layout-container">
      <div className="tile-library">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={`library-tile ${selectedTileId === tile.id ? "active" : ""}`}
            onClick={() => handleLibraryTileClick(tile.id)}
          >
            <img src={tile.image} alt={tile.name} />
          </div>
        ))}
        <button
          className="upload-tile-button"
          onClick={() => fileInputRef.current.click()}
        >
          + Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              const newTile = {
                id: Date.now(),
                name: file.name,
                image: URL.createObjectURL(file),
              };
              setTiles([...tiles, newTile]);
              setSelectedTileId(newTile.id);
            }
          }}
        />
      </div>

      <div className="preview-card">
        <div className="preview-header">
          <div>
            <p className="section-label">Generator</p>
            <h2>Tile Pattern Builder</h2>
          </div>
          <div className="action-group">
            <button
              className="ghost-button"
              onClick={handleCreateLayout}
              disabled={!loggedInUser}
            >
              Save New
            </button>
            <button
              className="ghost-button"
              onClick={handleUpdateLayout}
              disabled={!loggedInUser}
            >
              Update
            </button>
            <button className="ghost-button" onClick={handleResetLayout}>
              Reset
            </button>
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            className="section-label"
            style={{ display: "block", marginBottom: "8px" }}
          >
            Project Name
          </label>
          <input
            className="layout-name-input"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="Enter layout name..."
            style={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              color: "#10181e",
              width: "100%",
              padding: "10px",
            }}
          />
        </div>

        <div className="dimension-panel">
          <div>
            <label>Wall Width</label>
            <input
              type="number"
              value={wallWidth}
              onChange={(e) => setWallWidth(Number(e.target.value))}
            />
          </div>
          <div>
            <label>Wall Height</label>
            <input
              type="number"
              value={wallHeight}
              onChange={(e) => setWallHeight(Number(e.target.value))}
            />
          </div>
          <div>
            <label>Tile Size</label>
            <input
              type="number"
              value={tileWidth}
              onChange={(e) => setTileWidth(Number(e.target.value))}
            />
          </div>
          <div>
            <label>Grout</label>
            <input
              type="number"
              value={groutSize}
              onChange={(e) => setGroutSize(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="dimension-summary">
          <p>
            Grid: {gridRows}x{gridColumns} ({totalTiles} tiles)
          </p>
          <button
            className="ghost-button"
            onClick={handleApplyWallDimensions}
            style={{ background: "#7fa8c0", color: "#fff" }}
          >
            Apply Dimensions
          </button>
        </div>

        {statusMessage && (
          <p
            className="status-message"
            style={{
              background: "rgba(127, 168, 192, 0.1)",
              padding: "10px",
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            {statusMessage}
          </p>
        )}

        <div className="zoom-control">
          <label className="section-label">Zoom View</label>
          <div className="zoom-control-row">
            <input
              type="range"
              min="40"
              max="160"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
            />
            <span className="zoom-percentage">{zoomLevel}%</span>
          </div>
        </div>

        <div
          ref={gridRef}
          className="tile-grid"
          onPointerMove={handleAutoScroll}
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, ${Math.round(80 * (zoomLevel / 100))}px)`,
          }}
        >
          {layout.map((cell) => (
            <TileComponent
              key={cell.id}
              tile={tiles.find((t) => t.id === cell.tileId) || tiles[0]}
              rotation={cell.rotation}
              onPointerDown={() => handleGridPointerDown(cell.id)}
              onPointerEnter={(e) => handleGridPointerEnter(cell.id, e)}
            />
          ))}
        </div>
      </div>

      <aside className="saved-layouts-panel">
        <p className="section-label">Database</p>
        <h2>Saved Projects</h2>
        <input
          className="saved-layout-search"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            fetchSavedLayouts(e.target.value);
          }}
          placeholder="Search..."
        />
        <div className="saved-layout-list">
          {savedLayouts.map((sl) => (
            <div
              key={sl.id}
              className={`saved-layout-item ${selectedSavedLayoutId === sl.id ? "selected" : ""}`}
              style={{
                borderBottom: "1px solid #eee",
                paddingBottom: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: "bold", margin: 0 }}>
                  {sl.name || "Untitled"}
                </p>
                <p style={{ fontSize: "10px", color: "#888", margin: 0 }}>
                  ID: {sl.id}
                </p>
              </div>
              <div
                className="saved-layout-actions"
                style={{ display: "flex", gap: "5px" }}
              >
                <button
                  type="button"
                  onClick={() => handleLoadSavedLayout(sl)}
                  style={{
                    padding: "5px 10px",
                    background: "#20303b",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLayout(sl.id)}
                  style={{
                    padding: "5px 10px",
                    background: "transparent",
                    color: "#ff6b6b",
                    border: "1px solid #ff6b6b",
                    borderRadius: "4px",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default TilePreview;
```

---

## 5. CSS (App.css)

**File Location:** `/Users/ericadams/Desktop/PatternGenerator/frontend/src/App.css`

**Add/update these CSS sections in the file:**

```css
/* Add this after the :root and * rules, before the body rule */

/* --- Authentication --- */
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 20px;
}

.auth-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.auth-card h1 {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 30px;
  color: var(--accent-blue);
}

.auth-card h2 {
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 20px;
  color: #172128;
}

.auth-card form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.auth-card input {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.auth-card input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(127, 168, 192, 0.1);
}

.auth-card input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  color: #999;
}

.auth-card button[type="submit"] {
  padding: 12px;
  background: var(--accent-blue);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.auth-card button[type="submit"]:hover:not(:disabled) {
  background: #6b93ab;
}

.auth-card button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-card button[type="button"] {
  background: transparent;
  color: var(--accent-blue);
  border: none;
  font-size: 0.95rem;
  cursor: pointer;
  font-weight: 500;
  padding: 0;
  text-decoration: underline;
}

.auth-card p {
  text-align: center;
  color: #666;
  margin: 10px 0;
}

.auth-error {
  color: #e74c3c;
  font-size: 0.9rem;
  text-align: center;
  padding: 10px;
  background: #ffe6e6;
  border-radius: 6px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
  background: rgba(127, 168, 192, 0.1);
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 0.95rem;
}

.logout-button {
  padding: 8px 15px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.logout-button:hover {
  background: #c0392b;
}

/* Update the existing .ghost-button rules */
.ghost-button {
  background: var(--glass-white);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.ghost-button:hover:not(:disabled) {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
}

.ghost-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

---

## 6. FILE CHANGES SUMMARY

| File                           | Changes                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/server.js`            | Added `/register` POST endpoint, added `/login` POST endpoint, reorganized existing layout endpoints with section headers                                                                 |
| `frontend/src/App.jsx`         | Complete rewrite: added user state management, localStorage persistence, login/register UI, logout functionality, dynamic userId in saveLayout                                            |
| `frontend/src/TilePreview.jsx` | Added `loggedInUser` prop, removed hardcoded `USER_ID = 1`, updated fetchSavedLayouts to use loggedInUser, added loggedInUser checks on save buttons, disabled buttons when not logged in |
| `frontend/src/App.css`         | Added auth UI styles (.auth-container, .auth-card, .auth-error), added user info header (.app-header, .user-info, .logout-button), updated .ghost-button with disabled state              |
| Database                       | Created `users` table with id, username, email, password, created_at columns                                                                                                              |

---

## 7. TESTING STEPS

### Prerequisites

- Backend running on http://localhost:3001
- Frontend running on http://localhost:5173 (or your dev server port)
- MySQL database `tile_pattern_generator` with users table created

### Test Sequence

#### Step 1: Create and Save Design as User A

1. Open frontend in browser
2. Click **"Create one"** to register
3. Enter:
   - Username: `alice`
   - Email: `alice@test.com`
   - Password: `password123`
4. Click **Register** → Should see login screen briefly, then auto-login as alice
5. Verify top-right shows **"👤 alice"** with Logout button
6. Design a tile pattern (click tiles, place them, rotate if desired)
7. Name it: `Alice Pattern 1`
8. Click **Save New** → Should see success message
9. In **Saved Projects** panel on right, verify `Alice Pattern 1` appears

#### Step 2: Logout and Register User B

1. Click **Logout** button → Returns to login screen
2. Click **"Create one"** to register
3. Enter:
   - Username: `bob`
   - Email: `bob@test.com`
   - Password: `password456`
4. Click **Register** → Auto-login as bob
5. Verify top-right shows **"👤 bob"**
6. Verify **Saved Projects panel is EMPTY** (Bob cannot see Alice's layouts)

#### Step 3: User B Saves Design

1. Design a different tile pattern
2. Name it: `Bob Pattern 1`
3. Click **Save New** → Success message
4. Verify **Saved Projects** shows only `Bob Pattern 1`

#### Step 4: Login Back as User A

1. Click **Logout** → Login screen
2. Leave on login tab (don't register again)
3. Enter:
   - Email: `alice@test.com`
   - Password: `password123`
4. Click **Log In** → Should log in as alice
5. Verify top-right shows **"👤 alice"**
6. Verify **Saved Projects shows ONLY `Alice Pattern 1`** (Bob's layout is hidden)

#### Step 5: Test Data Persistence

1. Press F5 or Cmd+R to refresh page
2. Verify still logged in as alice (localStorage working)
3. Verify **`Alice Pattern 1` still appears** in Saved Projects
4. Click **Load** on Alice Pattern 1 → Should load the saved pattern into grid

#### Step 6: Test Invalid Login

1. Click **Logout**
2. Try logging in with:
   - Email: `alice@test.com`
   - Password: `wrong_password`
3. Click **Log In**
4. Should see error: **"Invalid password"**
5. Login screen should remain visible

#### Step 7: Test Duplicate Email Prevention

1. Click **"Create one"** to register
2. Try to register again with:
   - Username: `alice2`
   - Email: `alice@test.com` (duplicate)
   - Password: `pass`
3. Click **Register**
4. Should see error: **"User with that email or username already exists"**

#### Step 8: Test Save Button Disabled When Logged Out

1. Click **Logout** → Login screen
2. Cannot see **Save New** or **Update** buttons (they're hidden/replaced by login form)
3. Cannot interact with the tile editor (it's not visible)
4. Login/Register form takes full screen when logged out

#### Step 9: Test Search Filtering (User A)

1. Login as alice (alice@test.com / password123)
2. Create 2-3 more test layouts with different names (e.g., "Red Tiles", "Blue Pattern")
3. In **Saved Projects** search box, type "Red"
4. Only **"Red Tiles"** should show
5. Clear search → All alice's layouts should show again

#### Final Verification Checklist

- ✅ User A sees only User A's layouts
- ✅ User B sees only User B's layouts
- ✅ Logout clears UI and localStorage
- ✅ Login with correct credentials works
- ✅ Login with wrong password shows error message
- ✅ Registration prevents duplicate emails
- ✅ Data persists on page refresh (localStorage)
- ✅ Save buttons disabled/hidden when not logged in
- ✅ Tile placement works (click, drag-to-paint, rotate)
- ✅ Tile library and upload still work
- ✅ Search filters layouts by current user
- ✅ Load, Update, Delete work on user's own layouts

---

## Next Steps: Git Commit

After successful testing:

```bash
cd /Users/ericadams/Desktop/PatternGenerator

# Review changes
git status

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Add simple user system with register/login and user-specific layouts"

# Optional: Merge into main when ready
git checkout main
git merge add-user-system
```

---

**End of Implementation Guide**

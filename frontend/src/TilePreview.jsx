import { useEffect, useRef, useState } from 'react';
import TileComponent from './TileComponent';
import initialTiles from './data/tiles';
import initialLayout, { createLayout } from './data/layout';

const API_BASE_URL = 'http://localhost:3001';
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
  const [statusMessage, setStatusMessage] = useState('');
  const [wallWidth, setWallWidth] = useState(60);
  const [wallHeight, setWallHeight] = useState(60);
  const [tileWidth, setTileWidth] = useState(6);
  const [tileHeight, setTileHeight] = useState(6);
  const [groutSize, setGroutSize] = useState(0.25);
  const [gridColumns, setGridColumns] = useState(9);
  const [gridRows, setGridRows] = useState(9);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutName, setLayoutName] = useState('');
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
    window.addEventListener('pointerup', handleGlobalUp);
    return () => window.removeEventListener('pointerup', handleGlobalUp);
  }, []);

  useEffect(() => {
    fetchSavedLayouts();
  }, []);

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

  async function fetchSavedLayouts(searchValue = '') {
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
    setLayoutName('New Tile Design');
    setStatusMessage('Layout reset.');
  }

  function handleLoadSavedLayout(sl) {
    try {
      const loaded =
        typeof sl.layout === 'string' ? JSON.parse(sl.layout) : sl.layout;
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
      setStatusMessage('Error: Could not load layout.');
    }
  }

  async function handleCreateLayout() {
    if (!loggedInUser) {
      setStatusMessage('Please log in to save layouts.');
      return;
    }
    try {
      const nameToSave = layoutName.trim() || 'Untitled Layout';
      const success = await onSaveLayout(layout, nameToSave);
      if (success) {
        await fetchSavedLayouts(searchTerm);
        setStatusMessage(`Successfully saved "${nameToSave}"!`);
      }
    } catch (err) {
      setStatusMessage('Error saving layout.');
    }
  }

  async function handleUpdateLayout() {
    if (!selectedSavedLayoutId)
      return setStatusMessage('Select a layout first.');
    const nameToUpdate = layoutName.trim() || 'Untitled Layout';
    const res = await fetch(
      `${API_BASE_URL}/layouts/${selectedSavedLayoutId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedSavedLayoutId === id) handleResetLayout();
        await fetchSavedLayouts(searchTerm);
        setStatusMessage('Layout deleted.');
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
            className={`library-tile ${selectedTileId === tile.id ? 'active' : ''}`}
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
          style={{ display: 'none' }}
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

        <div style={{ marginBottom: '20px' }}>
          <label
            className="section-label"
            style={{ display: 'block', marginBottom: '8px' }}
          >
            Project Name
          </label>
          <input
            className="layout-name-input"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="New Tile Design"
            style={{
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#10181e',
              width: '100%',
              padding: '10px',
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
            style={{ background: '#7fa8c0', color: '#fff' }}
          >
            Apply Dimensions
          </button>
        </div>

        {statusMessage && (
          <p
            className="status-message"
            style={{
              background: 'rgba(127, 168, 192, 0.1)',
              padding: '10px',
              borderRadius: '8px',
              textAlign: 'center',
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
              className={`saved-layout-item ${selectedSavedLayoutId === sl.id ? 'selected' : ''}`}
              style={{
                borderBottom: '1px solid #eee',
                paddingBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 'bold', margin: 0 }}>
                  {sl.name || 'Untitled'}
                </p>
                <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>
                  ID: {sl.id}
                </p>
              </div>
              <div
                className="saved-layout-actions"
                style={{ display: 'flex', gap: '5px' }}
              >
                <button
                  type="button"
                  onClick={() => handleLoadSavedLayout(sl)}
                  style={{
                    padding: '5px 10px',
                    background: '#20303b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                  }}
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLayout(sl.id)}
                  style={{
                    padding: '5px 10px',
                    background: 'transparent',
                    color: '#ff6b6b',
                    border: '1px solid #ff6b6b',
                    borderRadius: '4px',
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

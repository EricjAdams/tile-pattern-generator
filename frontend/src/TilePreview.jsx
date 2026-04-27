import { useEffect, useRef, useState } from 'react';
import TileComponent from './TileComponent';
import initialTiles from './data/tiles';
import initialLayout, { createLayout } from './data/layout';

// TODO: Replace with authenticated user ID from session/token
const USER_ID = 1;

// Backend API endpoint for layout CRUD operations
const API_BASE_URL = 'http://localhost:3001';

const MAX_ROWS = 30;
const MAX_COLUMNS = 30;

function clampGridCount(value, max) {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), max);
}

function calculateGridCount(surfaceSize, tileSize, groutSize, max) {
  const effectiveTileSize = Number(tileSize) + Number(groutSize);

  if (effectiveTileSize <= 0) {
    return 1;
  }

  return clampGridCount(Number(surfaceSize) / effectiveTileSize, max);
}

function inferGridColumns(layoutData) {
  const squareRoot = Math.sqrt(layoutData.length);

  if (Number.isInteger(squareRoot)) {
    return squareRoot;
  }

  return 3;
}

// Main tile pattern builder component with paint mode, tile library, wall dimensions, and layout management
function TilePreview({ onSaveLayout }) {
  // Grid and tile editing state
  const [tiles, setTiles] = useState(initialTiles);
  const [layout, setLayout] = useState(initialLayout);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [lastClickedCellId, setLastClickedCellId] = useState(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Wall and tile dimension state
  const [wallWidth, setWallWidth] = useState(120);
  const [wallHeight, setWallHeight] = useState(96);
  const [tileWidth, setTileWidth] = useState(6);
  const [tileHeight, setTileHeight] = useState(6);
  const [groutSize, setGroutSize] = useState(0.25);

  // Active grid dimensions used by the rendered preview
  const [gridColumns, setGridColumns] = useState(3);
  const [gridRows, setGridRows] = useState(3);

  // Saved layouts and search state
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutName, setLayoutName] = useState('My Layout');
  const [selectedSavedLayoutId, setSelectedSavedLayoutId] = useState(null);

  // Refs for file upload and paint mode rotation
  const fileInputRef = useRef(null);
  const paintRotationRef = useRef(0);

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

  // Track pointer release to end drag-to-paint mode
  useEffect(() => {
    function handlePointerUp() {
      setIsPointerDown(false);
    }

    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Load all saved layouts on component mount
  useEffect(() => {
    fetchSavedLayouts();
  }, []);

  // Clear all paint mode state
  function resetPaintState() {
    setSelectedTileId(null);
    setLastClickedCellId(null);
    setIsPointerDown(false);
    paintRotationRef.current = 0;
  }

  // Reset cell tracking without clearing selected tile
  function resetCellTracking() {
    setLastClickedCellId(null);
    paintRotationRef.current = 0;
  }

  // Fetch layouts from database, optionally filtered by search term
  async function fetchSavedLayouts(searchValue = '') {
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${USER_ID}/layouts?search=${encodeURIComponent(
          searchValue,
        )}`,
      );

      if (!response.ok) {
        setStatusMessage('Could not load saved layouts.');
        return;
      }

      const data = await response.json();
      setSavedLayouts(data);
    } catch (error) {
      console.error('Error fetching saved layouts:', error);
      setStatusMessage('Could not connect to saved layouts.');
    }
  }

  // Regenerate the grid from the current wall and tile dimensions
  function handleApplyWallDimensions() {
    const nextRows = calculatedRows;
    const nextColumns = calculatedColumns;

    setGridRows(nextRows);
    setGridColumns(nextColumns);
    setLayout(createLayout(nextRows, nextColumns));
    setSelectedSavedLayoutId(null);
    resetPaintState();

    setStatusMessage(
      `Generated ${nextRows} rows x ${nextColumns} columns (${nextRows * nextColumns} tiles).`,
    );
  }

  // Place tile in grid cell with current rotation, then increment rotation for next placement
  function applyTileToCell(clickedId, tileId) {
    const nextRotation = paintRotationRef.current;
    paintRotationRef.current = (paintRotationRef.current + 90) % 360;

    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.id === clickedId
          ? {
              ...cell,
              tileId,
              rotation: nextRotation,
            }
          : cell,
      ),
    );
  }

  // Rotate tile in cell by 90 degrees
  function rotateCell(clickedId) {
    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.id === clickedId
          ? { ...cell, rotation: (cell.rotation + 90) % 360 }
          : cell,
      ),
    );
  }

  // Handle grid cell click: either apply tile if in paint mode or rotate existing tile
  function handleGridPointerDown(clickedId) {
    setIsPointerDown(true);

    if (selectedTileId !== null) {
      if (lastClickedCellId === clickedId) {
        rotateCell(clickedId);
        resetPaintState();
        setStatusMessage('Paint mode exited. Tile rotated.');
        return;
      }

      applyTileToCell(clickedId, selectedTileId);
      setLastClickedCellId(clickedId);
      setStatusMessage('Tile applied to grid.');
      return;
    }

    rotateCell(clickedId);
    setLastClickedCellId(clickedId);
    setStatusMessage('Tile rotated.');
  }

  // Handle drag-to-paint behavior
  function handleGridPointerEnter(clickedId) {
    if (!isPointerDown) return;
    if (selectedTileId === null) return;
    if (lastClickedCellId === clickedId) return;

    applyTileToCell(clickedId, selectedTileId);
    setLastClickedCellId(clickedId);
    setStatusMessage('Painting across grid.');
  }

  // Toggle tile selection in library
  function handleLibraryTileClick(tileId) {
    paintRotationRef.current = 0;

    setSelectedTileId((currentSelectedTileId) => {
      const nextSelectedTileId =
        currentSelectedTileId === tileId ? null : tileId;

      setStatusMessage(
        nextSelectedTileId === null
          ? 'Paint mode turned off.'
          : 'Paint mode active.',
      );

      return nextSelectedTileId;
    });

    setLastClickedCellId(null);
  }

  // Clear grid and return to the currently selected grid size
  function handleResetLayout() {
    setLayout(createLayout(gridRows, gridColumns));
    resetPaintState();
    setSelectedSavedLayoutId(null);
    setStatusMessage('Layout reset.');
  }

  // Trigger file input dialog
  function handleUploadButtonClick() {
    fileInputRef.current?.click();
  }

  // Add uploaded image to tile library and enter paint mode
  // Note: Uses client-side object URL; persists in session only
  function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    const newTile = {
      id: Date.now(),
      name: file.name.replace(/\.[^/.]+$/, ''),
      image: imageUrl,
    };

    setTiles((currentTiles) => [...currentTiles, newTile]);
    setSelectedTileId(newTile.id);
    resetCellTracking();
    setStatusMessage(`Uploaded "${newTile.name}" and entered paint mode.`);

    event.target.value = '';
  }

  // Save current layout to database
  async function handleCreateLayout() {
    await onSaveLayout(layout, layoutName);
    await fetchSavedLayouts(searchTerm);
    setStatusMessage(`Created saved layout "${layoutName}".`);
  }

  // Load a saved layout from database and display in grid
  function handleLoadSavedLayout(savedLayout) {
    const loadedLayout = Array.isArray(savedLayout.layout)
      ? savedLayout.layout
      : initialLayout;

    const inferredColumns = inferGridColumns(loadedLayout);
    const inferredRows = Math.ceil(loadedLayout.length / inferredColumns);

    setLayout(loadedLayout);
    setGridColumns(inferredColumns);
    setGridRows(inferredRows);
    setLayoutName(savedLayout.name);
    setSelectedSavedLayoutId(savedLayout.id);
    resetPaintState();
    setStatusMessage(`Loaded "${savedLayout.name}".`);
  }

  // Update currently loaded layout in database with grid changes
  async function handleUpdateLayout() {
    if (!selectedSavedLayoutId) {
      setStatusMessage('Select a saved layout before updating.');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/layouts/${selectedSavedLayoutId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: layoutName,
            layout,
          }),
        },
      );

      if (!response.ok) {
        setStatusMessage('Could not update layout.');
        return;
      }

      await fetchSavedLayouts(searchTerm);
      setStatusMessage(`Updated "${layoutName}".`);
    } catch (error) {
      console.error('Error updating layout:', error);
      setStatusMessage('Could not connect to update layout.');
    }
  }

  // Remove a saved layout from database
  async function handleDeleteLayout(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/layouts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        setStatusMessage('Could not delete layout.');
        return;
      }

      if (selectedSavedLayoutId === id) {
        setSelectedSavedLayoutId(null);
      }

      await fetchSavedLayouts(searchTerm);
      setStatusMessage('Saved layout deleted.');
    } catch (error) {
      console.error('Error deleting layout:', error);
      setStatusMessage('Could not connect to delete layout.');
    }
  }

  // Search saved layouts by name
  function handleSearchChange(event) {
    const value = event.target.value;
    setSearchTerm(value);
    fetchSavedLayouts(value);
  }

  return (
    <div className="layout-container">
      {/* Left panel: Tile library and upload */}
      <div className="tile-library">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={`library-tile ${
              selectedTileId === tile.id ? 'active' : ''
            }`}
            onClick={() => handleLibraryTileClick(tile.id)}
          >
            <img src={tile.image} alt={tile.name} />
          </div>
        ))}

        <button
          type="button"
          className="upload-tile-button"
          onClick={handleUploadButtonClick}
        >
          + Upload Tile
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden-file-input"
          onChange={handleFileUpload}
        />
      </div>

      {/* Center panel: Grid preview and controls */}
      <div className="preview-card">
        <div className="preview-header">
          <div>
            <p className="section-label">Preview</p>
            <h2>Tile Preview</h2>
          </div>

          <div className="action-group">
            <button className="ghost-button" onClick={handleCreateLayout}>
              Save New
            </button>
            <button className="ghost-button" onClick={handleUpdateLayout}>
              Update Selected
            </button>
            <button className="ghost-button" onClick={handleResetLayout}>
              Reset Layout
            </button>
          </div>
        </div>

        <p className="preview-text">
          Enter your wall and tile dimensions, generate the preview grid, then
          select a tile on the left to paint across the layout. Click and drag
          to apply it to multiple tiles. Click the same grid tile twice to
          rotate it and exit paint mode.
        </p>

        <div className="dimension-panel">
          <div>
            <label className="layout-name-label" htmlFor="wall-width">
              Wall width (in)
            </label>
            <input
              id="wall-width"
              className="layout-name-input"
              type="number"
              min="1"
              value={wallWidth}
              onChange={(event) => setWallWidth(Number(event.target.value))}
            />
          </div>

          <div>
            <label className="layout-name-label" htmlFor="wall-height">
              Wall height (in)
            </label>
            <input
              id="wall-height"
              className="layout-name-input"
              type="number"
              min="1"
              value={wallHeight}
              onChange={(event) => setWallHeight(Number(event.target.value))}
            />
          </div>

          <div>
            <label className="layout-name-label" htmlFor="tile-width">
              Tile width (in)
            </label>
            <input
              id="tile-width"
              className="layout-name-input"
              type="number"
              min="1"
              value={tileWidth}
              onChange={(event) => setTileWidth(Number(event.target.value))}
            />
          </div>

          <div>
            <label className="layout-name-label" htmlFor="tile-height">
              Tile height (in)
            </label>
            <input
              id="tile-height"
              className="layout-name-input"
              type="number"
              min="1"
              value={tileHeight}
              onChange={(event) => setTileHeight(Number(event.target.value))}
            />
          </div>

          <div>
            <label className="layout-name-label" htmlFor="grout-size">
              Grout spacing (in)
            </label>
            <input
              id="grout-size"
              className="layout-name-input"
              type="number"
              min="0"
              step="0.0625"
              value={groutSize}
              onChange={(event) => setGroutSize(Number(event.target.value))}
            />
          </div>
        </div>

        <div className="dimension-summary">
          <p>
            Calculated preview: {calculatedRows} rows x {calculatedColumns}{' '}
            columns
          </p>
          <p>
            Current grid: {gridRows} rows x {gridColumns} columns ({totalTiles}{' '}
            tiles)
          </p>
          <button
            type="button"
            className="ghost-button"
            onClick={handleApplyWallDimensions}
          >
            Generate Wall Grid
          </button>
        </div>

        <label className="layout-name-label" htmlFor="layout-name">
          Layout name
        </label>
        <input
          id="layout-name"
          className="layout-name-input"
          value={layoutName}
          onChange={(event) => setLayoutName(event.target.value)}
          placeholder="Enter layout name"
        />

        {statusMessage && <p className="status-message">{statusMessage}</p>}

        {/* Dynamic grid of tile cells for layout editing */}
        <div
          className="tile-grid"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, minmax(48px, 1fr))`,
          }}
        >
          {layout.map((cell) => {
            const tile = tiles.find((item) => item.id === cell.tileId);

            return (
              <TileComponent
                key={cell.id}
                tile={tile}
                rotation={cell.rotation}
                onPointerDown={() => handleGridPointerDown(cell.id)}
                onPointerEnter={() => handleGridPointerEnter(cell.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Right panel: Saved layouts list with search and load/delete */}
      <aside className="saved-layouts-panel">
        <p className="section-label">Database</p>
        <h2>Saved Layouts</h2>

        <input
          className="saved-layout-search"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search saved layouts"
        />

        <div className="saved-layout-list">
          {savedLayouts.length === 0 ? (
            <p className="empty-saved-layouts">No saved layouts found.</p>
          ) : (
            savedLayouts.map((savedLayout) => (
              <div
                key={savedLayout.id}
                className={`saved-layout-item ${
                  selectedSavedLayoutId === savedLayout.id ? 'selected' : ''
                }`}
              >
                <div>
                  <p className="saved-layout-name">{savedLayout.name}</p>
                  <p className="saved-layout-meta">ID {savedLayout.id}</p>
                </div>

                <div className="saved-layout-actions">
                  <button
                    type="button"
                    onClick={() => handleLoadSavedLayout(savedLayout)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLayout(savedLayout.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

export default TilePreview;

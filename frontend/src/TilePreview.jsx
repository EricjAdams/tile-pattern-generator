import { useEffect, useRef, useState } from 'react';
import TileComponent from './TileComponent';
import initialTiles from './data/tiles';
import initialLayout from './data/layout';

const USER_ID = 1;
const API_BASE_URL = 'http://localhost:3001';
const INITIAL_TILE_SIZE = 6;
const INITIAL_GROUT = 0.125;
const INITIAL_WALL_WIDTH = INITIAL_TILE_SIZE * 3 + INITIAL_GROUT * 2;
const INITIAL_WALL_HEIGHT = INITIAL_TILE_SIZE * 3 + INITIAL_GROUT * 2;
const VISUAL_PIXELS_PER_INCH = 20;
const MINIMUM_TILE_DISPLAY_SIZE = 36;
const MINIMUM_GROUT_DISPLAY_SIZE = 2;

function normalizeLayout(rawLayout) {
  let parsedLayout = rawLayout;

  if (typeof rawLayout === 'string') {
    try {
      parsedLayout = JSON.parse(rawLayout);
    } catch (error) {
      console.warn('Saved layout parse failed:', error, rawLayout);
      return null;
    }
  }

  if (!Array.isArray(parsedLayout)) {
    console.warn('Saved layout is not an array:', parsedLayout);
    return null;
  }

  return parsedLayout.map((cell, index) => {
    if (typeof cell !== 'object' || cell === null) {
      console.warn('Saved layout item is invalid, using default cell:', cell);
      return {
        id: index + 1,
        tileId: 1,
        rotation: 0,
      };
    }

    return {
      id: Number(cell.id) || index + 1,
      tileId: Number(cell.tileId) || 1,
      rotation: Number(cell.rotation) || 0,
    };
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function inferLayoutDimensions(cells, fallbackWidth = 3) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return { width: fallbackWidth, height: 1 };
  }

  const length = cells.length;
  const square = Math.round(Math.sqrt(length));

  if (square * square === length) {
    return { width: square, height: square };
  }

  for (let width = 1; width <= 24; width += 1) {
    if (length % width === 0) {
      return { width, height: length / width };
    }
  }

  const width = clamp(fallbackWidth, 1, length);
  return { width, height: Math.ceil(length / width) };
}

function resizeLayout(layout, width, height) {
  const count = width * height;
  return Array.from({ length: count }, (_, index) => {
    const existing = layout[index];
    return {
      id: index + 1,
      tileId: existing?.tileId ?? 1,
      rotation: existing?.rotation ?? 0,
    };
  });
}

function getGridSize(wallSize, tileSize, grout) {
  if (!Number.isFinite(wallSize) || wallSize <= 0 || !Number.isFinite(tileSize) || tileSize <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor((wallSize + grout) / (tileSize + grout)));
}

function parseNumberInput(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getWallDimensionFromTileCount(count, tileSize, grout) {
  return count * tileSize + Math.max(0, count - 1) * grout;
}

function TilePreview({ onSaveLayout }) {
  const [tiles, setTiles] = useState(initialTiles);
  const [layout, setLayout] = useState(initialLayout);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [lastClickedCellId, setLastClickedCellId] = useState(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [savedLayouts, setSavedLayouts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutName, setLayoutName] = useState('My Layout');
  const [selectedSavedLayoutId, setSelectedSavedLayoutId] = useState(null);
  const [wallWidth, setWallWidth] = useState(INITIAL_WALL_WIDTH);
  const [wallHeight, setWallHeight] = useState(INITIAL_WALL_HEIGHT);
  const [tileSize, setTileSize] = useState(INITIAL_TILE_SIZE);
  const [grout, setGrout] = useState(INITIAL_GROUT);
  const [zoom, setZoom] = useState(100);
  const [zoomInput, setZoomInput] = useState('100');
  const [tileToDelete, setTileToDelete] = useState(null);

  const fileInputRef = useRef(null);
  const paintRotationRef = useRef(0);

  useEffect(() => {
    function handlePointerUp() {
      setIsPointerDown(false);
    }

    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    fetchSavedLayouts();
  }, []);

  function resetPaintState() {
    setSelectedTileId(null);
    setLastClickedCellId(null);
    setIsPointerDown(false);
    paintRotationRef.current = 0;
  }

  function resetCellTracking() {
    setLastClickedCellId(null);
    paintRotationRef.current = 0;
  }

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
      setSavedLayouts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching saved layouts:', error);
      setSavedLayouts([]);
      setStatusMessage('Could not connect to saved layouts.');
    }
  }

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

  function rotateCell(clickedId) {
    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.id === clickedId
          ? { ...cell, rotation: (cell.rotation + 90) % 360 }
          : cell,
      ),
    );
  }

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

  function handleGridPointerEnter(clickedId) {
    if (!isPointerDown) return;
    if (selectedTileId === null) return;
    if (lastClickedCellId === clickedId) return;

    applyTileToCell(clickedId, selectedTileId);
    setLastClickedCellId(clickedId);
    setStatusMessage('Painting across grid.');
  }

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

  function handleResetLayout() {
    setLayout(initialLayout);
    setWallWidth(INITIAL_WALL_WIDTH);
    setWallHeight(INITIAL_WALL_HEIGHT);
    setTileSize(INITIAL_TILE_SIZE);
    setGrout(INITIAL_GROUT);
    resetPaintState();
    setSelectedSavedLayoutId(null);
    setStatusMessage('Layout reset.');
  }

  function handleUploadButtonClick() {
    fileInputRef.current?.click();
  }

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

  function handleRequestDeleteTile(tile) {
    setTileToDelete(tile);
  }

  function handleCancelDeleteTile() {
    setTileToDelete(null);
  }

  function handleConfirmDeleteTile() {
    if (!tileToDelete) {
      return;
    }

    const nextTiles = tiles.filter((item) => item.id !== tileToDelete.id);
    const safeTileId = nextTiles[0]?.id ?? 0;

    setTiles(nextTiles);
    setSelectedTileId((currentSelectedTileId) =>
      currentSelectedTileId === tileToDelete.id ? null : currentSelectedTileId,
    );
    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.tileId === tileToDelete.id
          ? { ...cell, tileId: safeTileId, rotation: 0 }
          : cell,
      ),
    );
    setTileToDelete(null);
    setStatusMessage(`Deleted tile "${tileToDelete.name}".`);
  }

  function handleZoomSliderChange(event) {
    const nextZoom = Number(event.target.value);
    setZoom(nextZoom);
    setZoomInput(String(nextZoom));
  }

  function handleZoomInputChange(event) {
    const inputValue = event.target.value;
    if (/^\d*$/.test(inputValue)) {
      setZoomInput(inputValue);
    }
  }

  function commitZoomInputValue() {
    if (!zoomInput.trim()) {
      setZoomInput(String(zoom));
      return;
    }

    const parsed = Number(zoomInput);
    if (!Number.isFinite(parsed)) {
      setZoomInput(String(zoom));
      return;
    }

    const clamped = clamp(parsed, 20, 200);
    setZoom(clamped);
    setZoomInput(String(clamped));
  }

  function handleZoomInputKeyDown(event) {
    if (event.key === 'Enter') {
      commitZoomInputValue();
    }
  }

  function handleApplyDimensions() {
    const nextWallWidth = clamp(wallWidth, 0.25, 240);
    const nextWallHeight = clamp(wallHeight, 0.25, 240);
    const nextTileSize = clamp(tileSize, 0.25, 240);
    const nextGrout = clamp(grout, 0, 4);

    const columns = getGridSize(nextWallWidth, nextTileSize, nextGrout);
    const rows = getGridSize(nextWallHeight, nextTileSize, nextGrout);

    setWallWidth(nextWallWidth);
    setWallHeight(nextWallHeight);
    setTileSize(nextTileSize);
    setGrout(nextGrout);
    setLayout((currentLayout) => resizeLayout(currentLayout, columns, rows));
    setSelectedSavedLayoutId(null);
    resetPaintState();
    setStatusMessage(`Applied ${columns}×${rows} grid dimensions.`);
  }

  async function handleCreateLayout() {
    console.log('Saving layout payload:', { name: layoutName, layout });
    try {
      await onSaveLayout(layout, layoutName);
      await fetchSavedLayouts(searchTerm);
      setStatusMessage(`Created saved layout "${layoutName}".`);
    } catch (error) {
      console.error('Create layout failed:', error);
      setStatusMessage('Could not save layout.');
    }
  }

  function handleLoadSavedLayout(savedLayout) {
    const normalized = normalizeLayout(savedLayout.layout);

    if (!normalized) {
      console.warn('Invalid saved layout, load aborted:', savedLayout);
      setStatusMessage('Unable to load saved layout. Layout data is invalid.');
      return;
    }

    const dimensions = inferLayoutDimensions(normalized, wallWidth);
    setWallWidth(getWallDimensionFromTileCount(dimensions.width, tileSize, grout));
    setWallHeight(getWallDimensionFromTileCount(dimensions.height, tileSize, grout));
    setLayout(normalized);
    setLayoutName(savedLayout.name || '');
    setSelectedSavedLayoutId(savedLayout.id);
    resetPaintState();
    setStatusMessage(`Loaded "${savedLayout.name || 'layout'}".`);
  }

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

  function handleSearchChange(event) {
    const value = event.target.value;
    setSearchTerm(value);
    fetchSavedLayouts(value);
  }

  const defaultTile = tiles[0] || { id: 0, image: '', name: 'Empty tile' };
  const safeSavedLayouts = Array.isArray(savedLayouts) ? savedLayouts : [];
  const gridColumns = getGridSize(wallWidth, tileSize, grout);
  const displayTileSize = Math.max(
    MINIMUM_TILE_DISPLAY_SIZE,
    tileSize * VISUAL_PIXELS_PER_INCH,
  );
  const displayGrout = Math.max(
    MINIMUM_GROUT_DISPLAY_SIZE,
    grout * VISUAL_PIXELS_PER_INCH,
  );

  return (
    <div className="layout-container">
      <div className="tile-library">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={`library-tile ${
              selectedTileId === tile.id ? 'active' : ''
            }`}
            onClick={() => handleLibraryTileClick(tile.id)}
          >
            <button
              type="button"
              className="delete-tile-button"
              onClick={(event) => {
                event.stopPropagation();
                handleRequestDeleteTile(tile);
              }}
              aria-label={`Delete ${tile.name}`}
            >
              ×
            </button>
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
          Select a tile on the left to paint across the grid. Click and drag to
          apply it to multiple tiles. Click the same grid tile twice to rotate
          it and exit paint mode.
        </p>

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

        <div className="preview-controls">
          <div className="control-grid">
            <div className="control-group">
              <label htmlFor="wall-width">Wall width</label>
              <input
                id="wall-width"
                className="control-input"
                type="number"
                min="0.25"
                max="240"
                step="0.25"
                value={wallWidth}
                onChange={(event) => setWallWidth(parseNumberInput(event.target.value, 0.25))}
              />
            </div>

            <div className="control-group">
              <label htmlFor="wall-height">Wall height</label>
              <input
                id="wall-height"
                className="control-input"
                type="number"
                min="0.25"
                max="240"
                step="0.25"
                value={wallHeight}
                onChange={(event) => setWallHeight(parseNumberInput(event.target.value, 0.25))}
              />
            </div>

            <div className="control-group">
              <label htmlFor="tile-size">Tile size</label>
              <input
                id="tile-size"
                className="control-input"
                type="number"
                min="0.25"
                max="240"
                step="0.25"
                value={tileSize}
                onChange={(event) => setTileSize(parseNumberInput(event.target.value, INITIAL_TILE_SIZE))}
              />
            </div>

            <div className="control-group">
              <label htmlFor="grout-width">Grout</label>
              <input
                id="grout-width"
                className="control-input"
                type="number"
                min="0"
                max="4"
                step="0.0625"
                value={grout}
                onChange={(event) => setGrout(parseNumberInput(event.target.value, INITIAL_GROUT))}
              />
            </div>

            <div className="control-group full-width">
              <button
                type="button"
                className="control-button"
                onClick={handleApplyDimensions}
              >
                Apply Dimensions
              </button>
            </div>
          </div>

          <div className="zoom-controls">
            <div className="zoom-label-row">
              <span>Zoom</span>
              <strong>{zoom}%</strong>
            </div>
            <input
              type="range"
              min="20"
              max="200"
              step="5"
              value={zoom}
              onChange={handleZoomSliderChange}
            />
            <input
              type="number"
              className="control-input"
              min="20"
              max="200"
              step="5"
              value={zoomInput}
              onChange={handleZoomInputChange}
              onBlur={commitZoomInputValue}
              onKeyDown={handleZoomInputKeyDown}
            />
          </div>
        </div>

        {statusMessage && <p className="status-message">{statusMessage}</p>}

        <div className="tile-grid-wrapper">
          <div
            className="tile-grid"
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, ${displayTileSize}px)`,
              gridAutoRows: `${displayTileSize}px`,
              gap: `${displayGrout}px`,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
            }}
          >
            {layout.map((cell) => {
              const tile = tiles.find((item) => item.id === cell.tileId) || defaultTile;

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
      </div>

      {tileToDelete && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p>Are you sure you want to delete this tile?</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={handleCancelDeleteTile}
              >
                Cancel
              </button>
              <button
                type="button"
                className="control-button"
                onClick={handleConfirmDeleteTile}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
          {safeSavedLayouts.length === 0 ? (
            <p className="empty-saved-layouts">No saved layouts found.</p>
          ) : (
            safeSavedLayouts.map((savedLayout) => (
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

import { useEffect, useRef, useState } from 'react';
import TileComponent from './TileComponent';
import initialTiles from './data/tiles';
import initialLayout from './data/layout';

const USER_ID = 1;
const API_BASE_URL = 'http://localhost:3001';

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

  const fileInputRef = useRef(null);

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

  function applyTileToCell(clickedId, tileId) {
    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.id === clickedId
          ? {
              ...cell,
              tileId,
              rotation: Math.floor(Math.random() * 4) * 90,
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
        setSelectedTileId(null);
        setLastClickedCellId(null);
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
    setSelectedTileId(null);
    setLastClickedCellId(null);
    setIsPointerDown(false);
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
    setLastClickedCellId(null);
    setStatusMessage(`Uploaded "${newTile.name}" and entered paint mode.`);

    event.target.value = '';
  }

  async function handleCreateLayout() {
    await onSaveLayout(layout, layoutName);
    await fetchSavedLayouts(searchTerm);
    setStatusMessage(`Created saved layout "${layoutName}".`);
  }

  function handleLoadSavedLayout(savedLayout) {
    setLayout(savedLayout.layout);
    setLayoutName(savedLayout.name);
    setSelectedSavedLayoutId(savedLayout.id);
    setSelectedTileId(null);
    setLastClickedCellId(null);
    setIsPointerDown(false);
    setStatusMessage(`Loaded "${savedLayout.name}".`);
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

        {statusMessage && <p className="status-message">{statusMessage}</p>}

        <div className="tile-grid">
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

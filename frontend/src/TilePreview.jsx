import { useEffect, useRef, useState } from 'react';
import TileComponent from './TileComponent';
import initialTiles from './data/tiles';
import initialLayout from './data/layout';

const SAVED_LAYOUT_KEY = 'tile-pattern-generator-layout';

function TilePreview() {
  const [tiles, setTiles] = useState(initialTiles);
  const [layout, setLayout] = useState(initialLayout);
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [lastClickedCellId, setLastClickedCellId] = useState(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

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

  function applyTileToCell(clickedId, tileId) {
    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.id === clickedId
          ? {
              ...cell,
              tileId,
            }
          : cell,
      ),
    );
  }

  function rotateCell(clickedId) {
    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.id === clickedId
          ? {
              ...cell,
              rotation: (cell.rotation + 90) % 360,
            }
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

  function handleSaveLayout() {
    const dataToSave = {
      layout,
      savedAt: new Date().toLocaleString(),
    };

    localStorage.setItem(SAVED_LAYOUT_KEY, JSON.stringify(dataToSave));
    setStatusMessage('Layout saved locally.');
  }

  function handleLoadLayout() {
    const savedData = localStorage.getItem(SAVED_LAYOUT_KEY);

    if (!savedData) {
      setStatusMessage('No saved layout found.');
      return;
    }

    try {
      const parsedData = JSON.parse(savedData);

      if (!parsedData.layout || !Array.isArray(parsedData.layout)) {
        setStatusMessage('Saved layout data is invalid.');
        return;
      }

      setLayout(parsedData.layout);
      setSelectedTileId(null);
      setLastClickedCellId(null);
      setStatusMessage(
        `Saved layout loaded${parsedData.savedAt ? ` (${parsedData.savedAt})` : ''}.`,
      );
    } catch {
      setStatusMessage('Could not load saved layout.');
    }
  }

  function handleClearSavedLayout() {
    localStorage.removeItem(SAVED_LAYOUT_KEY);
    setStatusMessage('Saved layout cleared.');
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
            <button className="ghost-button" onClick={handleSaveLayout}>
              Save Layout
            </button>
            <button className="ghost-button" onClick={handleLoadLayout}>
              Load Layout
            </button>
            <button className="ghost-button" onClick={handleClearSavedLayout}>
              Clear Saved
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
    </div>
  );
}

export default TilePreview;

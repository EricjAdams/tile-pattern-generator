import { useCallback, useEffect, useRef, useState } from 'react';
import TileComponent from './TileComponent';
import initialTiles from './data/tiles';
import { randomizeLayout } from './utils/randomizeLayout';

const API_BASE_URL = 'http://localhost:3001';
const INITIAL_TILE_SIZE = 6;
const INITIAL_GROUT = 0.125;
const INITIAL_WALL_WIDTH = INITIAL_TILE_SIZE * 3 + INITIAL_GROUT * 2;
const INITIAL_WALL_HEIGHT = INITIAL_TILE_SIZE * 3 + INITIAL_GROUT * 2;
const VISUAL_PIXELS_PER_INCH = 20;
const MINIMUM_TILE_DISPLAY_SIZE = 36;
const MINIMUM_GROUT_DISPLAY_SIZE = 2;
const INITIAL_COLUMNS = 3;
const INITIAL_ROWS = 3;
const SAMPLE_LAYOUT_PREFIX = '[SAMPLE]';

function isSampleLayoutName(name) {
  return String(name || '').trim().startsWith(SAMPLE_LAYOUT_PREFIX);
}

function getUserCopyLayoutName(name) {
  const copyName = String(name || '')
    .replace(/^\[SAMPLE\]\s*/i, '')
    .trim();

  return copyName || 'My Layout';
}

function getTilesReferencedByLayout(cells, availableTiles) {
  const referencedTileKeys = new Set(
    cells.map((cell) => cell.tileKey).filter(Boolean),
  );

  return availableTiles.filter((tile) => referencedTileKeys.has(tile.key));
}

function createEmptyLayout(columns = INITIAL_COLUMNS, rows = INITIAL_ROWS) {
  return Array.from({ length: columns * rows }, (_, index) => ({
    id: index + 1,
    tileId: null,
    tileKey: undefined,
    rotation: 0,
  }));
}

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
        tileId: null,
        tileKey: undefined,
        rotation: 0,
      };
    }

    const tileId = Number(cell.tileId);

    return {
      id: Number(cell.id) || index + 1,
      tileId: Number.isFinite(tileId) && tileId > 0 ? tileId : null,
      tileKey: typeof cell.tileKey === 'string' ? cell.tileKey : undefined,
      rotation: Number(cell.rotation) || 0,
    };
  });
}

function normalizeSavedProject(rawProject) {
  let parsedProject = rawProject;

  if (typeof rawProject === 'string') {
    try {
      parsedProject = JSON.parse(rawProject);
    } catch (error) {
      console.warn('Saved project parse failed:', error, rawProject);
      return null;
    }
  }

  if (Array.isArray(parsedProject)) {
    const cells = normalizeLayout(parsedProject);
    return cells ? { isLegacy: true, cells } : null;
  }

  if (
    typeof parsedProject !== 'object' ||
    parsedProject === null ||
    !Array.isArray(parsedProject.cells)
  ) {
    console.warn('Saved project is invalid:', parsedProject);
    return null;
  }

  const cells = normalizeLayout(parsedProject.cells);

  if (!cells) {
    return null;
  }

  return {
    isLegacy: false,
    version: Number(parsedProject.version) || 2,
    cells,
    columns: Number(parsedProject.columns),
    rows: Number(parsedProject.rows),
    wallWidth: Number(parsedProject.wallWidth),
    wallHeight: Number(parsedProject.wallHeight),
    tileSize: Number(parsedProject.tileSize),
    grout: Number(parsedProject.grout),
    zoom: Number(parsedProject.zoom),
  };
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

  for (let width = square; width >= 2; width -= 1) {
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
      tileId: existing?.tileId ?? null,
      tileKey: existing?.tileKey,
      rotation: existing?.rotation ?? 0,
    };
  });
}

function getGridSize(wallSize, tileSize, grout) {
  if (
    !Number.isFinite(wallSize) ||
    wallSize <= 0 ||
    !Number.isFinite(tileSize) ||
    tileSize <= 0
  ) {
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

function resolveTileForCell(cell, tiles) {
  if (cell.tileKey) {
    return tiles.find((item) => item.key === cell.tileKey) || null;
  }

  return tiles.find((item) => item.id === cell.tileId) || null;
}

function normalizeUploadedTile(tile) {
  const imageUrl = tile.image || tile.imageUrl || '';
  const tileKey = tile.tileKey || tile.key;

  return {
    id: tile.id,
    key: tileKey,
    tileKey,
    name: tile.name || 'Uploaded tile',
    image: imageUrl.startsWith('/uploads')
      ? `${API_BASE_URL}${imageUrl}`
      : imageUrl,
    source: 'uploaded',
  };
}

function TilePreview({ userId, authToken, onAuthExpired, onSaveLayout }) {
  const [uploadedTiles, setUploadedTiles] = useState([]);
  const [layout, setLayout] = useState(() => createEmptyLayout());
  const [selectedTileKey, setSelectedTileKey] = useState(null);
  const [selectedTileKeys, setSelectedTileKeys] = useState([]);
  const [lastClickedCellId, setLastClickedCellId] = useState(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasStartedDesigning, setHasStartedDesigning] = useState(false);

  const [savedLayouts, setSavedLayouts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutName, setLayoutName] = useState('My Layout');
  const [selectedSavedLayoutId, setSelectedSavedLayoutId] = useState(null);
  const [loadedLayoutIsSample, setLoadedLayoutIsSample] = useState(false);
  const [wallWidth, setWallWidth] = useState(INITIAL_WALL_WIDTH);
  const [wallHeight, setWallHeight] = useState(INITIAL_WALL_HEIGHT);
  const [tileSize, setTileSize] = useState(INITIAL_TILE_SIZE);
  const [grout, setGrout] = useState(INITIAL_GROUT);
  const [zoom, setZoom] = useState(100);
  const [zoomInput, setZoomInput] = useState('100');
  const [tileToDelete, setTileToDelete] = useState(null);

  const paintRotationRef = useRef(0);
  const tileLoadRequestIdRef = useRef(0);
  const lastUploadSignatureRef = useRef('');

  const getAuthToken = useCallback(() => {
    return typeof authToken === 'string' ? authToken.trim() : '';
  }, [authToken]);

  const getAuthHeaders = useCallback(() => {
    const token = getAuthToken();

    return {
      Authorization: `Bearer ${token}`,
    };
  }, [getAuthToken]);

  const getJsonAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    };
  }, [getAuthHeaders]);

  useEffect(() => {
    function handlePointerUp() {
      setIsPointerDown(false);
    }

    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  function resetPaintState() {
    setSelectedTileKey(null);
    setSelectedTileKeys([]);
    setLastClickedCellId(null);
    setIsPointerDown(false);
    paintRotationRef.current = 0;
  }

  function resetCellTracking() {
    setLastClickedCellId(null);
    paintRotationRef.current = 0;
  }

  const fetchSavedLayouts = useCallback(async (searchValue = '') => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${userId}/layouts?search=${encodeURIComponent(
          searchValue,
        )}`,
        {
          headers: getAuthHeaders(),
        },
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
  }, [getAuthHeaders, userId]);

  const fetchUploadedTiles = useCallback(async () => {
    const requestId = tileLoadRequestIdRef.current + 1;
    tileLoadRequestIdRef.current = requestId;
    const token = getAuthToken();

    setUploadedTiles([]);
    setSelectedTileKey(null);
    setSelectedTileKeys([]);
    setHasStartedDesigning(false);

    if (!token || !userId) {
      setStatusMessage('Please log in before uploading tiles.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/tiles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (requestId !== tileLoadRequestIdRef.current) {
          return;
        }

        if (response.status === 401) {
          setStatusMessage(
            'Your session is missing or expired. Please log in again.',
          );
          onAuthExpired?.();
          return;
        }

        setStatusMessage('Could not load uploaded tiles.');
        return;
      }

      const data = await response.json();
      const uploadedTiles = Array.isArray(data)
        ? data.map(normalizeUploadedTile)
        : [];

      if (requestId !== tileLoadRequestIdRef.current) {
        return;
      }

      setUploadedTiles(uploadedTiles);
    } catch (error) {
      if (requestId !== tileLoadRequestIdRef.current) {
        return;
      }

      console.error('Error fetching uploaded tiles:', error);
      setStatusMessage('Could not load uploaded tiles.');
    }
  }, [getAuthToken, onAuthExpired, userId]);

  useEffect(() => {
    const loadSavedLayouts = window.setTimeout(() => {
      fetchSavedLayouts();
    }, 0);

    return () => {
      window.clearTimeout(loadSavedLayouts);
    };
  }, [fetchSavedLayouts]);

  useEffect(() => {
    const loadUploadedTiles = window.setTimeout(() => {
      fetchUploadedTiles();
    }, 0);

    return () => {
      window.clearTimeout(loadUploadedTiles);
    };
  }, [fetchUploadedTiles]);

  function applyTileToCell(clickedId, tile) {
    const nextRotation = paintRotationRef.current;
    paintRotationRef.current = (paintRotationRef.current + 90) % 360;

    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.id === clickedId
          ? {
              ...cell,
              tileId: tile.id,
              tileKey: tile.key,
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

    if (selectedTileKey !== null) {
      const selectedTile = tiles.find((tile) => tile.key === selectedTileKey);

      if (!selectedTile) {
        setStatusMessage('Selected tile is unavailable.');
        resetPaintState();
        return;
      }

      if (lastClickedCellId === clickedId) {
        rotateCell(clickedId);
        resetPaintState();
        setStatusMessage('Paint mode exited. Tile rotated.');
        return;
      }

      applyTileToCell(clickedId, selectedTile);
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
    if (selectedTileKey === null) return;
    if (lastClickedCellId === clickedId) return;

    const selectedTile = tiles.find((tile) => tile.key === selectedTileKey);

    if (!selectedTile) {
      resetPaintState();
      setStatusMessage('Selected tile is unavailable.');
      return;
    }

    applyTileToCell(clickedId, selectedTile);
    setLastClickedCellId(clickedId);
    setStatusMessage('Painting across grid.');
  }

  function handleLibraryTileClick(tileKey) {
    paintRotationRef.current = 0;

    const isAlreadySelected = selectedTileKeys.includes(tileKey);
    const nextSelectedTileKeys = isAlreadySelected
      ? selectedTileKeys.filter((selectedKey) => selectedKey !== tileKey)
      : [...selectedTileKeys, tileKey];
    const nextPaintTileKey = isAlreadySelected
      ? selectedTileKey === tileKey
        ? nextSelectedTileKeys[nextSelectedTileKeys.length - 1] ?? null
        : selectedTileKey
      : tileKey;

    setSelectedTileKeys(nextSelectedTileKeys);
    setSelectedTileKey(nextPaintTileKey);
    setHasStartedDesigning(true);

    setStatusMessage(
      nextSelectedTileKeys.length === 0
        ? 'Paint mode turned off.'
        : `Selected ${nextSelectedTileKeys.length} tile${
            nextSelectedTileKeys.length === 1 ? '' : 's'
          }.`,
    );

    setLastClickedCellId(null);
  }

  function handleResetLayout() {
    setLayout(createEmptyLayout());
    setWallWidth(INITIAL_WALL_WIDTH);
    setWallHeight(INITIAL_WALL_HEIGHT);
    setTileSize(INITIAL_TILE_SIZE);
    setGrout(INITIAL_GROUT);
    resetPaintState();
    setSelectedSavedLayoutId(null);
    setLoadedLayoutIsSample(false);
    setHasStartedDesigning(uploadedTiles.length > 0);
    setStatusMessage('Layout reset.');
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    const token = getAuthToken();

    if (files.length === 0) {
      setStatusMessage('No files selected.');
      return;
    }

    if (!token || !userId) {
      setStatusMessage('Please log in before uploading tiles.');
      event.target.value = '';
      return;
    }

    const uploadSignature = files
      .map((file) => `${file.name}:${file.size}:${file.lastModified}`)
      .join('|');

    if (uploadSignature === lastUploadSignatureRef.current) {
      return;
    }

    lastUploadSignatureRef.current = uploadSignature;

    setStatusMessage(
      files.length === 1
        ? 'Files selected: 1. Sending upload request...'
        : `Files selected: ${files.length}. Sending upload request...`,
    );

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('tileImages', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/tiles`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          setStatusMessage(
            'Upload failed: your session is missing or expired. Please log in again.',
          );
          onAuthExpired?.();
          return;
        }

        setStatusMessage(
          `Upload failed: ${response.status} ${data?.error || response.statusText}`,
        );
        return;
      }

      const uploadedTiles = Array.isArray(data)
        ? data.map(normalizeUploadedTile)
        : [];

      if (uploadedTiles.length === 0) {
        setStatusMessage('No tile images were uploaded.');
        return;
      }

      tileLoadRequestIdRef.current += 1;
      setUploadedTiles((currentTiles) => [...currentTiles, ...uploadedTiles]);
      setSelectedTileKey(uploadedTiles[0].key);
      setSelectedTileKeys([uploadedTiles[0].key]);
      setHasStartedDesigning(true);
      resetCellTracking();
      setStatusMessage(
        uploadedTiles.length === 1
          ? `Upload succeeded: 1 tile. "${uploadedTiles[0].name}" is selected.`
          : `Upload succeeded: ${uploadedTiles.length} tiles. First tile is selected.`,
      );
    } catch (error) {
      console.error('Tile upload failed:', error);
      setStatusMessage('Upload failed: could not connect to upload tiles.');
    } finally {
      event.target.value = '';
      lastUploadSignatureRef.current = '';
    }
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

    const nextUploadedTiles = uploadedTiles.filter(
      (item) => item.key !== tileToDelete.key,
    );
    const nextSelectedTileKeys = selectedTileKeys.filter(
      (selectedKey) => selectedKey !== tileToDelete.key,
    );

    setUploadedTiles(nextUploadedTiles);
    setSelectedTileKey(
      selectedTileKey === tileToDelete.key
        ? nextSelectedTileKeys[nextSelectedTileKeys.length - 1] ?? null
        : selectedTileKey,
    );
    setSelectedTileKeys(nextSelectedTileKeys);
    setLayout((currentLayout) =>
      currentLayout.map((cell) =>
        cell.tileKey === tileToDelete.key ||
        (!cell.tileKey && cell.tileId === tileToDelete.id)
          ? {
              ...cell,
              tileId: null,
              tileKey: undefined,
              rotation: 0,
            }
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
    setHasStartedDesigning(true);
    resetPaintState();
    setStatusMessage(`Applied ${columns}×${rows} grid dimensions.`);
  }

  function handleRandomizeLayout() {
    const randomizableTiles = loadedLayoutIsSample
      ? getTilesReferencedByLayout(layout, renderableTiles)
      : tiles.filter((tile) => selectedTileKeys.includes(tile.key));

    if (randomizableTiles.length === 0) {
      setStatusMessage('Select or upload tiles before randomizing.');
      return;
    }

    setLayout((currentLayout) =>
      randomizeLayout(currentLayout, randomizableTiles),
    );
    setHasStartedDesigning(true);
    resetCellTracking();
    setStatusMessage(
      loadedLayoutIsSample
        ? 'Randomized pattern with the loaded sample tile set.'
        : 'Randomized pattern with the selected tile set.',
    );
  }

  async function handleCreateLayout() {
    const nextLayoutName = getUserCopyLayoutName(layoutName);
    const projectSnapshot = buildProjectSnapshot();

    try {
      await onSaveLayout(projectSnapshot, nextLayoutName);
      await fetchSavedLayouts(searchTerm);
      setLayoutName(nextLayoutName);
      setSelectedSavedLayoutId(null);
      setLoadedLayoutIsSample(false);
      setStatusMessage(`Created saved layout "${nextLayoutName}".`);
    } catch (error) {
      console.error('Create layout failed:', error);
      setStatusMessage(error.message || 'Could not save layout.');
    }
  }

  function handleLoadSavedLayout(savedLayout) {
    const savedProject = normalizeSavedProject(savedLayout.layout);

    if (!savedProject) {
      console.warn('Invalid saved layout, load aborted:', savedLayout);
      setStatusMessage('Unable to load saved layout. Layout data is invalid.');
      return;
    }

    if (savedProject.isLegacy) {
      const dimensions = inferLayoutDimensions(
        savedProject.cells,
        getGridSize(wallWidth, tileSize, grout),
      );
      setWallWidth(
        getWallDimensionFromTileCount(dimensions.width, tileSize, grout),
      );
      setWallHeight(
        getWallDimensionFromTileCount(dimensions.height, tileSize, grout),
      );
    } else {
      const nextTileSize = Number.isFinite(savedProject.tileSize)
        ? savedProject.tileSize
        : tileSize;
      const nextGrout = Number.isFinite(savedProject.grout)
        ? savedProject.grout
        : grout;
      const fallbackDimensions = inferLayoutDimensions(
        savedProject.cells,
        getGridSize(wallWidth, nextTileSize, nextGrout),
      );
      const savedColumns = Number.isFinite(savedProject.columns)
        ? savedProject.columns
        : fallbackDimensions.width;
      const savedRows = Number.isFinite(savedProject.rows)
        ? savedProject.rows
        : fallbackDimensions.height;

      setTileSize(nextTileSize);
      setGrout(nextGrout);
      setWallWidth(
        Number.isFinite(savedProject.wallWidth)
          ? savedProject.wallWidth
          : getWallDimensionFromTileCount(
              savedColumns,
              nextTileSize,
              nextGrout,
            ),
      );
      setWallHeight(
        Number.isFinite(savedProject.wallHeight)
          ? savedProject.wallHeight
          : getWallDimensionFromTileCount(
              savedRows,
              nextTileSize,
              nextGrout,
            ),
      );

      if (Number.isFinite(savedProject.zoom)) {
        const nextZoom = clamp(savedProject.zoom, 20, 200);
        setZoom(nextZoom);
        setZoomInput(String(nextZoom));
      }
    }

    const isSampleLayout = isSampleLayoutName(savedLayout.name);

    setLayout(savedProject.cells);
    setLayoutName(
      isSampleLayout
        ? getUserCopyLayoutName(savedLayout.name)
        : savedLayout.name || '',
    );
    setSelectedSavedLayoutId(savedLayout.id);
    setLoadedLayoutIsSample(isSampleLayout);
    setHasStartedDesigning(true);
    resetPaintState();
    setStatusMessage(
      isSampleLayout
        ? `Loaded "${savedLayout.name || 'layout'}" as an editable copy. Use Save New to save your version.`
        : `Loaded "${savedLayout.name || 'layout'}".`,
    );
  }

  async function handleUpdateLayout() {
    if (!selectedSavedLayoutId) {
      setStatusMessage('Select a saved layout before updating.');
      return;
    }

    if (loadedLayoutIsSample) {
      setStatusMessage(
        'Sample layouts cannot be updated. Use Save New to save your version.',
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/users/${userId}/layouts/${selectedSavedLayoutId}`,
        {
          method: 'PUT',
          headers: getJsonAuthHeaders(),
          body: JSON.stringify({
            name: layoutName,
            layout: buildProjectSnapshot(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error || 'Could not update layout.');
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
      const response = await fetch(
        `${API_BASE_URL}/users/${userId}/layouts/${id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
      );

      if (!response.ok) {
        setStatusMessage('Could not delete layout.');
        return;
      }

      if (selectedSavedLayoutId === id) {
        setSelectedSavedLayoutId(null);
        setLoadedLayoutIsSample(false);
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

  function buildProjectSnapshot() {
    const columns = getGridSize(wallWidth, tileSize, grout);
    const rows = getGridSize(wallHeight, tileSize, grout);

    return {
      version: 2,
      cells: layout,
      columns,
      rows,
      wallWidth,
      wallHeight,
      tileSize,
      grout,
      zoom,
    };
  }

  const visibleUploadedTiles = uploadedTiles;
  const tiles = visibleUploadedTiles;
  const renderableTiles = [...initialTiles, ...visibleUploadedTiles];
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
  const shouldShowTileGrid =
    hasStartedDesigning || visibleUploadedTiles.length > 0;

  return (
    <div className="layout-container">
      <div className="tile-library">
        <label
          className="upload-tile-button"
          htmlFor="tile-upload-input"
        >
          + Upload Tile
        </label>

        <input
          id="tile-upload-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden-file-input"
          onInput={handleFileUpload}
          onChange={handleFileUpload}
        />

        {visibleUploadedTiles.length === 0 && (
          <p className="section-label">
            No tiles uploaded yet. Upload tiles to begin designing.
          </p>
        )}

        {visibleUploadedTiles.map((tile) => (
          <div
            key={tile.key}
            className={`library-tile ${
              selectedTileKeys.includes(tile.key) ? 'active' : ''
            } ${
              selectedTileKey === tile.key ? 'paint-active' : ''
            }`}
            onClick={() => handleLibraryTileClick(tile.key)}
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
            <button
              className="ghost-button"
              onClick={handleUpdateLayout}
              disabled={loadedLayoutIsSample}
              title={
                loadedLayoutIsSample
                  ? 'Sample layouts must be saved as a new layout.'
                  : undefined
              }
            >
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
                onChange={(event) =>
                  setWallWidth(parseNumberInput(event.target.value, 0.25))
                }
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
                onChange={(event) =>
                  setWallHeight(parseNumberInput(event.target.value, 0.25))
                }
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
                onChange={(event) =>
                  setTileSize(
                    parseNumberInput(event.target.value, INITIAL_TILE_SIZE),
                  )
                }
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
                onChange={(event) =>
                  setGrout(parseNumberInput(event.target.value, INITIAL_GROUT))
                }
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

            <div className="control-group full-width">
              <button
                type="button"
                className="control-button secondary-control-button"
                onClick={handleRandomizeLayout}
              >
                Randomize Pattern
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

        {shouldShowTileGrid && (
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
                const tile = resolveTileForCell(cell, renderableTiles);

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
        )}
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

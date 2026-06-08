const SAMPLE_LAYOUT_PREFIX = '[SAMPLE]'
const VALID_ROTATIONS = [0, 90, 180, 270]
const INITIAL_COLUMNS = 3
const INITIAL_ROWS = 3

export function isSampleLayoutName(name) {
  return String(name || '').trim().startsWith(SAMPLE_LAYOUT_PREFIX)
}

export function getUserCopyLayoutName(name) {
  const copyName = String(name || '').replace(new RegExp('^\\[SAMPLE\\]\\s*', 'i'), '').trim()
  return copyName || 'My Layout'
}

export function getSampleCopyLayoutName(name) {
  const copyName = getUserCopyLayoutName(name)
  return copyName.toLowerCase().startsWith('copy of ')
    ? copyName
    : `Copy of ${copyName}`
}

export function getTilesReferencedByLayout(cells, availableTiles) {
  const referencedTileKeys = new Set()
  const referencedTileIds = new Set()

  cells.forEach((cell) => {
    if (cell?.tileKey) {
      referencedTileKeys.add(cell.tileKey)
      return
    }

    if (Number.isFinite(cell?.tileId) && cell.tileId > 0) {
      referencedTileIds.add(cell.tileId)
    }
  })

  return availableTiles.filter(
    (tile) =>
      referencedTileKeys.has(tile.key) || referencedTileIds.has(tile.id),
  )
}

export function getRandomizableTiles({
  isSampleDerivedLayout,
  originalLoadedLayout,
  selectedTileKeys,
  tiles,
  renderableTiles,
  currentLayout,
}) {
  if (isSampleDerivedLayout) {
    const sampleTiles =
      Array.isArray(originalLoadedLayout?.sampleTiles) &&
      originalLoadedLayout.sampleTiles.length > 0
        ? originalLoadedLayout.sampleTiles
        : getTilesReferencedByLayout(
            originalLoadedLayout?.cells ?? [],
            renderableTiles,
          )

    return sampleTiles.length > 0
      ? sampleTiles
      : getTilesReferencedByLayout(currentLayout ?? [], renderableTiles)
  }

  if (Array.isArray(selectedTileKeys) && selectedTileKeys.length > 0) {
    return tiles.filter((tile) => selectedTileKeys.includes(tile.key))
  }

  return getTilesReferencedByLayout(currentLayout ?? [], renderableTiles)
}

export function createEmptyLayout(columns = INITIAL_COLUMNS, rows = INITIAL_ROWS) {
  return Array.from({ length: columns * rows }, (_, index) => ({
    id: index + 1,
    tileId: null,
    tileKey: undefined,
    rotation: 0,
  }))
}

export function cloneLayout(cells) {
  return Array.isArray(cells)
    ? cells.map((cell, index) => ({
        id: Number(cell?.id) || index + 1,
        tileId: cell?.tileId ?? null,
        tileKey: cell?.tileKey,
        rotation: cell?.rotation ?? 0,
      }))
    : []
}

export function normalizeLayout(rawLayout) {
  let parsedLayout = rawLayout

  if (typeof rawLayout === 'string') {
    try {
      parsedLayout = JSON.parse(rawLayout)
    } catch (error) {
      console.warn('Saved layout parse failed:', error, rawLayout)
      return null
    }
  }

  if (!Array.isArray(parsedLayout)) {
    console.warn('Saved layout is not an array:', parsedLayout)
    return null
  }

  return parsedLayout.map((cell, index) => {
    if (typeof cell !== 'object' || cell === null) {
      console.warn('Saved layout item is invalid, using default cell:', cell)
      return {
        id: index + 1,
        tileId: null,
        tileKey: undefined,
        rotation: 0,
      }
    }

    const tileId = Number(cell.tileId)

    return {
      id: Number(cell.id) || index + 1,
      tileId: Number.isFinite(tileId) && tileId > 0 ? tileId : null,
      tileKey: typeof cell.tileKey === 'string' ? cell.tileKey : undefined,
      rotation: Number(cell.rotation) || 0,
    }
  })
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function inferLayoutDimensions(cells, fallbackWidth = 3) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return { width: fallbackWidth, height: 1 }
  }

  const length = cells.length
  const square = Math.round(Math.sqrt(length))

  if (square * square === length) {
    return { width: square, height: square }
  }

  for (let width = square; width >= 2; width -= 1) {
    if (length % width === 0) {
      return { width, height: length / width }
    }
  }

  const width = clamp(fallbackWidth, 1, length)
  return { width, height: Math.ceil(length / width) }
}

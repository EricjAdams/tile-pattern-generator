import { describe, expect, it } from 'vitest'
import {
  createEmptyLayout,
  cloneLayout,
  normalizeLayout,
  inferLayoutDimensions,
  getRandomizableTiles,
  getTilesReferencedByLayout,
} from './utils/layoutHelpers'

describe('TilePreview helpers', () => {
  it('creates an empty 3x3 layout by default', () => {
    const layout = createEmptyLayout()

    expect(layout).toHaveLength(9)
    expect(layout[0]).toEqual({
      id: 1,
      tileId: null,
      tileKey: undefined,
      rotation: 0,
    })
    expect(layout[8].id).toBe(9)
  })

  it('clones a layout array with normalized fields', () => {
    const original = [
      { id: '2', tileId: '4', tileKey: 'stone', rotation: '180' },
      { id: 3, tileId: null, tileKey: undefined, rotation: 0 },
    ]

    const copy = cloneLayout(original)

    expect(copy).toEqual([
      { id: 2, tileId: '4', tileKey: 'stone', rotation: '180' },
      { id: 3, tileId: null, tileKey: undefined, rotation: 0 },
    ])
    expect(copy).not.toBe(original)
  })

  it('normalizes a JSON string layout into structured cells', () => {
    const raw = JSON.stringify([
      { id: '4', tileId: '2', tileKey: 'blue', rotation: '90' },
      { id: null, tileId: '0', tileKey: null, rotation: null },
    ])

    expect(normalizeLayout(raw)).toEqual([
      { id: 4, tileId: 2, tileKey: 'blue', rotation: 90 },
      { id: 2, tileId: null, tileKey: undefined, rotation: 0 },
    ])
  })

  it('returns null for invalid normalized layout input', () => {
    expect(normalizeLayout('not valid json')).toBeNull()
    expect(normalizeLayout(123)).toBeNull()
  })

  it('infers dimensions for a square layout', () => {
    expect(inferLayoutDimensions(Array.from({ length: 9 }))).toEqual({
      width: 3,
      height: 3,
    })
  })

  it('infers dimensions for a non-square layout with even divisor', () => {
    expect(inferLayoutDimensions(Array.from({ length: 10 }))).toEqual({
      width: 2,
      height: 5,
    })
  })

  it('filters tiles referenced by layout cells', () => {
    const cells = [
      { tileKey: 'blue' },
      { tileId: 7 },
      { tileKey: 'missing' },
    ]
    const availableTiles = [
      { id: 7, key: 'red' },
      { id: 8, key: 'blue' },
      { id: 9, key: 'green' },
    ]

    expect(getTilesReferencedByLayout(cells, availableTiles)).toEqual([
      { id: 7, key: 'red' },
      { id: 8, key: 'blue' },
    ])
  })

  it('returns selected uploaded tiles when selectedTileKeys are present', () => {
    const tiles = [
      { id: 1, key: 'alpha' },
      { id: 2, key: 'beta' },
      { id: 3, key: 'gamma' },
    ]
    const selectedTileKeys = ['beta']

    expect(
      getRandomizableTiles({
        isSampleDerivedLayout: false,
        originalLoadedLayout: null,
        selectedTileKeys,
        tiles,
        renderableTiles: [],
        currentLayout: [],
      }),
    ).toEqual([{ id: 2, key: 'beta' }])
  })

  it('derives the pool from the current layout when no selection exists for saved layouts', () => {
    const tiles = [
      { id: 1, key: 'alpha' },
      { id: 2, key: 'beta' },
      { id: 3, key: 'gamma' },
    ]
    const layout = [
      { tileKey: 'gamma' },
      { tileId: 2 },
    ]

    expect(
      getRandomizableTiles({
        isSampleDerivedLayout: false,
        originalLoadedLayout: null,
        selectedTileKeys: [],
        tiles,
        renderableTiles: tiles,
        currentLayout: layout,
      }),
    ).toEqual([
      { id: 2, key: 'beta' },
      { id: 3, key: 'gamma' },
    ])
  })

  it('uses original sampleTiles when sample-derived layout has a non-empty sample tile array', () => {
    const sampleTiles = [{ id: 7, key: 'sample-a' }]
    const renderableTiles = [{ id: 7, key: 'sample-a' }]

    expect(
      getRandomizableTiles({
        isSampleDerivedLayout: true,
        originalLoadedLayout: {
          isSample: true,
          sampleTiles,
          cells: [{ tileKey: 'sample-a' }],
        },
        selectedTileKeys: [],
        tiles: [],
        renderableTiles,
        currentLayout: [],
      }),
    ).toEqual(sampleTiles)
  })

  it('falls back to referenced tiles when sample-derived layout sampleTiles is empty', () => {
    const renderableTiles = [
      { id: 7, key: 'sample-a' },
      { id: 8, key: 'sample-b' },
    ]
    const originalLoadedLayout = {
      isSample: true,
      sampleTiles: [],
      cells: [{ tileKey: 'sample-b' }],
    }

    expect(
      getRandomizableTiles({
        isSampleDerivedLayout: true,
        originalLoadedLayout,
        selectedTileKeys: [],
        tiles: [],
        renderableTiles,
        currentLayout: [],
      }),
    ).toEqual([{ id: 8, key: 'sample-b' }])
  })
})

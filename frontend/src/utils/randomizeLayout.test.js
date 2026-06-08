import { describe, expect, it } from 'vitest'
import { randomizeLayout } from './randomizeLayout'

const VALID_ROTATIONS = [0, 90, 180, 270]

describe('randomizeLayout', () => {
  it('returns an empty array for invalid input', () => {
    expect(randomizeLayout(null, null)).toEqual([])
    expect(randomizeLayout(undefined, undefined)).toEqual([])
    expect(randomizeLayout({}, [])).toEqual([])
  })

  it('clones the current layout when no tile types are selected', () => {
    const currentLayout = [
      { id: 1, tileId: null, tileKey: undefined, rotation: 0 },
      { id: 2, tileId: 5, tileKey: 'tile-5', rotation: 90 },
    ]

    const nextLayout = randomizeLayout(currentLayout, [])

    expect(nextLayout).toEqual(currentLayout)
    expect(nextLayout).not.toBe(currentLayout)
    expect(nextLayout[0]).not.toBe(currentLayout[0])
  })

  it('assigns a valid tile and rotation for each cell when tile types are selected', () => {
    const currentLayout = [
      { id: 1, tileId: null, tileKey: undefined, rotation: 0 },
      { id: 2, tileId: null, tileKey: undefined, rotation: 0 },
    ]
    const selectedTileTypes = [
      { id: 7, key: 'brick' },
      { id: 8, key: 'marble' },
    ]

    const nextLayout = randomizeLayout(currentLayout, selectedTileTypes)

    expect(nextLayout).toHaveLength(currentLayout.length)
    nextLayout.forEach((cell, index) => {
      expect(cell.id).toBe(currentLayout[index].id)
      expect([7, 8]).toContain(cell.tileId)
      expect(['brick', 'marble']).toContain(cell.tileKey)
      expect(VALID_ROTATIONS).toContain(cell.rotation)
    })
  })
})

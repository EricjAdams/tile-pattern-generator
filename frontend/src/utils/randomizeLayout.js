const VALID_ROTATIONS = [0, 90, 180, 270];

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomizeLayout(currentLayout, selectedTileTypes) {
  if (!Array.isArray(currentLayout) || !Array.isArray(selectedTileTypes)) {
    return [];
  }

  if (selectedTileTypes.length === 0) {
    return currentLayout.map((cell) => ({ ...cell }));
  }

  // Build a fresh cell array so React receives new state while the existing
  // grid shape, cell ids, and future layout metadata remain untouched.
  return currentLayout.map((cell, index) => {
    const tile = pickRandomItem(selectedTileTypes);
    const rotation = pickRandomItem(VALID_ROTATIONS);

    return {
      ...cell,
      id: cell?.id ?? index + 1,
      tileId: tile.id,
      tileKey: tile.key,
      rotation,
    };
  });
}


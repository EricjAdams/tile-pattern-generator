/**
 * Generates a tile layout grid based on the number of rows and columns.
 *
 * @param {number} rows - Number of rows in the grid
 * @param {number} columns - Number of columns in the grid
 * @param {number} defaultTileId - The default tile to populate each cell
 * @returns {Array} Array of tile objects with id, tileId, and rotation
 */
function createLayout(rows = 3, columns = 3, defaultTileId = 1) {
  return Array.from({ length: rows * columns }, (_, index) => ({
    id: index + 1,        // Unique identifier for each tile cell
    tileId: defaultTileId, // Tile type assigned to the cell
    rotation: 0,           // Initial rotation (0 degrees)
  }));
}

// Default layout (keeps current app working with a 3x3 grid)
const layout = createLayout(3, 3);

export { createLayout };
export default layout;
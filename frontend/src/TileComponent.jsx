function TileComponent({ tile, rotation = 0, onPointerDown, onPointerEnter }) {
  return (
    <button
      className="tile tile-photo"
      type="button"
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onDragStart={(event) => event.preventDefault()}
    >
      <img
        src={tile.image}
        alt={tile.name}
        className="tile-photo-image"
        style={{ transform: `rotate(${rotation}deg)` }}
      />
    </button>
  );
}

export default TileComponent;

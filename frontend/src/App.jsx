import './App.css';
import TilePreview from './TilePreview';

function App() {
  const saveLayout = async (layout, name) => {
    try {
      const response = await fetch('http://localhost:3001/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1,
          name: name,
          layout: JSON.stringify(layout), // MySQL needs the grid as a string
        }),
      });

      if (!response.ok) throw new Error('Database rejected the save');

      const data = await response.json();
      console.log('Save successful:', data);
      return true; // Tells TilePreview to refresh the sidebar
    } catch (error) {
      console.error('Save error:', error);
      return false;
    }
  };

  return (
    <div className="app-container">
      <div className="app-shell">
        <h1>Tile Pattern Generator</h1>
        <TilePreview onSaveLayout={saveLayout} />
      </div>
      <footer className="footer">
        Created by Eric Adams • Tile Pattern Generator Prototype
      </footer>
    </div>
  );
}

export default App;

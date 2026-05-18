import './App.css';
import TilePreview from './TilePreview';

function App() {
  const saveLayout = async (layout, name) => {
    try {
      const payload = { name, layout };
      console.log('Sending save payload:', payload);

      const response = await fetch('http://localhost:3001/users/1/layouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Save layout failed:', response.status, data);
        throw new Error(data.error || 'Save failed');
      }

      console.log('Saved:', data);
      alert('Layout saved to database!');
    } catch (error) {
      console.error('Error saving layout:', error);
      alert('Could not save layout.');
      throw error;
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

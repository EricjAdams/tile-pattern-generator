import './App.css';
import TilePreview from './TilePreview';

function App() {
  return (
    <div className="app-container">
      <div className="app-shell">
        <h1>Tile Pattern Generator</h1>
        <TilePreview />
      </div>

      <footer className="footer">
        Created by Eric Adams • Tile Pattern Generator Prototype
      </footer>
    </div>
  );
}

export default App;

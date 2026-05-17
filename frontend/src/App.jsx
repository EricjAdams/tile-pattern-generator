import { useState, useEffect } from 'react';
import './App.css';
import TilePreview from './TilePreview';

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const API_BASE_URL = 'http://localhost:3001';

  // Load user from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('loggedInUser');
    if (saved) {
      try {
        setLoggedInUser(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || 'Registration failed');
        setAuthLoading(false);
        return;
      }

      // Registration successful (auto-login)
      setLoggedInUser(data);
      localStorage.setItem('loggedInUser', JSON.stringify(data));
      setEmail('');
      setPassword('');
      setUsername('');
      setAuthMode('login');
    } catch (error) {
      setAuthError('Network error: ' + error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || 'Login failed');
        setAuthLoading(false);
        return;
      }

      // Login successful
      setLoggedInUser(data);
      localStorage.setItem('loggedInUser', JSON.stringify(data));
      setEmail('');
      setPassword('');
      setUsername('');
    } catch (error) {
      setAuthError('Network error: ' + error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    localStorage.removeItem('loggedInUser');
    setEmail('');
    setPassword('');
    setUsername('');
    setAuthError('');
  };

  // ✅ FIXED: layout is no longer double-stringified
  const saveLayout = async (layout, name) => {
    try {
      const response = await fetch(`${API_BASE_URL}/layouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: loggedInUser.id,
          name,
          layout, // send as object, backend handles stringify
        }),
      });

      if (!response.ok) throw new Error('Database rejected the save');

      const data = await response.json();
      console.log('Save successful:', data);
      return true;
    } catch (error) {
      console.error('Save error:', error);
      return false;
    }
  };

  // If not logged in, show auth UI
  if (!loggedInUser) {
    return (
      <div className="app-container">
        <div className="auth-container">
          <div className="auth-card">
            <h1>Tile Pattern Generator</h1>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin}>
                <h2>Log In</h2>

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={authLoading}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={authLoading}
                />

                {authError && <p className="auth-error">{authError}</p>}

                <button type="submit" disabled={authLoading}>
                  {authLoading ? 'Logging in...' : 'Log In'}
                </button>

                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                    }}
                  >
                    Create one
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <h2>Register</h2>

                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={authLoading}
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={authLoading}
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={authLoading}
                />

                {authError && <p className="auth-error">{authError}</p>}

                <button type="submit" disabled={authLoading}>
                  {authLoading ? 'Creating account...' : 'Register'}
                </button>

                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                  >
                    Log in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Logged in UI
  return (
    <div className="app-container">
      <div className="app-shell">
        <div className="app-header">
          <h1>Tile Pattern Generator</h1>

          <div className="user-info">
            <span>👤 {loggedInUser.username}</span>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <TilePreview onSaveLayout={saveLayout} loggedInUser={loggedInUser} />
      </div>

      <footer className="footer">
        Created by Eric Adams • Tile Pattern Generator Prototype
      </footer>
    </div>
  );
}

export default App;

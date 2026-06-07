import { useCallback, useState } from 'react';
import './App.css';
import TilePreview from './TilePreview';

const API_BASE_URL = 'http://localhost:3001';
const CURRENT_USER_STORAGE_KEY = 'tilePatternCurrentUser';
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{5,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getStoredCurrentUser() {
  try {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return null;
  } catch (error) {
    console.warn('Stored user could not be loaded:', error);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return null;
  }
}

function validatePassword(password) {
  if (password.length < 8 || password.length > 128) {
    return 'Password must be 8-128 characters.';
  }

  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return 'Password must include uppercase, lowercase, number, and symbol characters.';
  }

  return '';
}

function App() {
  const [currentUser, setCurrentUser] = useState(getStoredCurrentUser);
  const [authMode, setAuthMode] = useState('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStatus, setLoginStatus] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] =
    useState('');
  const [deleteAccountStatus, setDeleteAccountStatus] = useState('');
  const [showDeleteAccountPassword, setShowDeleteAccountPassword] =
    useState(false);
  const [activeView, setActiveView] = useState('designer');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLayouts, setAdminLayouts] = useState([]);
  const [adminStatus, setAdminStatus] = useState('');

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentUser.token}`,
    };
  }

  const saveLayout = async (projectSnapshot, name) => {
    if (!currentUser) {
      throw new Error('You must log in before saving layouts.');
    }

    try {
      const payload = { name, layout: projectSnapshot };
      console.log('Sending save payload:', payload);

      const response = await fetch(
        `${API_BASE_URL}/users/${currentUser.id}/layouts`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('Save layout failed:', response.status, data);
        throw new Error(data.error || 'Save failed');
      }

      console.log('Saved:', data);
      alert('Layout saved to database!');
    } catch (error) {
      console.error('Error saving layout:', error);
      alert(error.message || 'Could not save layout.');
      throw error;
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginStatus('');

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: loginIdentifier,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginStatus(data.error || 'Login failed.');
        return;
      }

      setCurrentUser(data);
      setLoginIdentifier('');
      setLoginPassword('');
      setLoginStatus('');
      setActiveView('designer');
      setAdminStatus('');
    } catch (error) {
      console.error('Login failed:', error);
      setLoginStatus('Could not connect to login.');
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoginStatus('');

    const username = registerUsername.trim();
    const email = registerEmail.trim();

    if (!USERNAME_PATTERN.test(username)) {
      setLoginStatus(
        'Username must be 5-30 characters and use only letters, numbers, underscores, or hyphens.',
      );
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      setLoginStatus('Enter a valid email address.');
      return;
    }

    const passwordError = validatePassword(registerPassword);
    if (passwordError) {
      setLoginStatus(passwordError);
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setLoginStatus('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password: registerPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginStatus(data.error || 'Registration failed.');
        return;
      }

      setCurrentUser(data);
      setRegisterUsername('');
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterConfirmPassword('');
      setLoginStatus('');
      setActiveView('designer');
      setAdminStatus('');
    } catch (error) {
      console.error('Registration failed:', error);
      setLoginStatus('Could not connect to registration.');
    }
  };

  const handleLogout = async () => {
    const token = currentUser?.token;

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setCurrentUser(null);
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      setShowDeleteAccountDialog(false);
      setDeleteAccountPassword('');
      setDeleteAccountConfirmation('');
      setDeleteAccountStatus('');
      setActiveView('designer');
      setAdminUsers([]);
      setAdminLayouts([]);
      setAdminStatus('');
    }
  };

  const handleAuthExpired = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    setShowDeleteAccountDialog(false);
    setDeleteAccountPassword('');
    setDeleteAccountConfirmation('');
    setDeleteAccountStatus('');
    setLoginStatus('Your session expired. Please sign in again.');
    setActiveView('designer');
    setAdminUsers([]);
    setAdminLayouts([]);
    setAdminStatus('');
  }, []);

  const handleAuthModeChange = (nextMode) => {
    setAuthMode(nextMode);
    setLoginStatus('');
  };

  const handleOpenDeleteAccountDialog = () => {
    setDeleteAccountPassword('');
    setDeleteAccountConfirmation('');
    setDeleteAccountStatus('');
    setShowDeleteAccountPassword(false);
    setShowDeleteAccountDialog(true);
  };

  const handleCancelDeleteAccount = () => {
    setShowDeleteAccountDialog(false);
    setDeleteAccountPassword('');
    setDeleteAccountConfirmation('');
    setDeleteAccountStatus('');
    setShowDeleteAccountPassword(false);
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    setDeleteAccountStatus('');

    if (!currentUser) {
      return;
    }

    if (!deleteAccountPassword || deleteAccountConfirmation !== 'DELETE') {
      setDeleteAccountStatus('Enter your password and type DELETE to confirm.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/${currentUser.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          password: deleteAccountPassword,
          confirmation: deleteAccountConfirmation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteAccountStatus(data.error || 'Account deletion failed.');
        return;
      }

      setCurrentUser(null);
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      setShowDeleteAccountDialog(false);
      setDeleteAccountPassword('');
      setDeleteAccountConfirmation('');
      setDeleteAccountStatus('');
      setLoginStatus('Account deleted.');
      setActiveView('designer');
      setAdminUsers([]);
      setAdminLayouts([]);
    } catch (error) {
      console.error('Account deletion failed:', error);
      setDeleteAccountStatus('Could not connect to delete account.');
    }
  };

  const fetchAdminDashboard = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      setAdminStatus('Access Denied');
      return;
    }

    setAdminStatus('');

    try {
      const [usersResponse, layoutsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/users`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE_URL}/admin/layouts`, {
          headers: getAuthHeaders(),
        }),
      ]);

      const usersData = await usersResponse.json();
      const layoutsData = await layoutsResponse.json();

      if (!usersResponse.ok) {
        setAdminStatus(usersData.error || 'Could not load admin users.');
        return;
      }

      if (!layoutsResponse.ok) {
        setAdminStatus(layoutsData.error || 'Could not load admin layouts.');
        return;
      }

      setAdminUsers(Array.isArray(usersData) ? usersData : []);
      setAdminLayouts(Array.isArray(layoutsData) ? layoutsData : []);
    } catch (error) {
      console.error('Admin dashboard fetch failed:', error);
      setAdminStatus('Could not connect to admin dashboard.');
    }
  };

  const handleOpenAdminDashboard = () => {
    setActiveView('admin');
    fetchAdminDashboard();
  };

  const handleDeleteAdminLayout = async (layoutId) => {
    if (!currentUser || currentUser.role !== 'admin') {
      setAdminStatus('Access Denied');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/layouts/${layoutId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        setAdminStatus(data.error || 'Could not delete layout.');
        return;
      }

      setAdminLayouts((currentLayouts) =>
        currentLayouts.filter((layout) => layout.id !== layoutId),
      );
      setAdminStatus('Layout deleted.');
    } catch (error) {
      console.error('Admin layout delete failed:', error);
      setAdminStatus('Could not connect to delete layout.');
    }
  };

  return (
    <div className="app-container">
      <div className="app-shell">
        <h1>Tile Pattern Generator</h1>

        {currentUser ? (
          <>
            <div className="user-bar">
              <div>
                <p className="section-label">Signed in</p>
                <p className="user-bar-name">
                  {currentUser.username} · {currentUser.email}
                </p>
              </div>
              <div className="user-bar-actions">
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={
                      activeView === 'admin'
                        ? () => setActiveView('designer')
                        : handleOpenAdminDashboard
                    }
                  >
                    {activeView === 'admin' ? 'Designer' : 'Admin'}
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-button danger-button"
                  onClick={handleOpenDeleteAccountDialog}
                >
                  Delete Account
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>

            {activeView === 'admin' ? (
              <section className="admin-dashboard">
                {currentUser.role !== 'admin' ? (
                  <p className="status-message">Access Denied</p>
                ) : (
                  <>
                    <div className="admin-header">
                      <div>
                        <p className="section-label">Admin</p>
                        <h2>Admin Dashboard</h2>
                      </div>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={fetchAdminDashboard}
                      >
                        Refresh
                      </button>
                    </div>

                    {adminStatus && (
                      <p className="status-message">{adminStatus}</p>
                    )}

                    <div className="admin-section">
                      <h3>Users</h3>
                      <div className="admin-table-wrapper">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Username</th>
                              <th>Email</th>
                              <th>Role</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminUsers.map((user) => (
                              <tr key={user.id}>
                                <td>{user.id}</td>
                                <td>{user.username}</td>
                                <td>{user.email}</td>
                                <td>{user.role}</td>
                                <td>
                                  {user.deleted_at ? 'Deleted' : 'Active'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="admin-section">
                      <h3>Layouts</h3>
                      <div className="admin-table-wrapper">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Name</th>
                              <th>Owner</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminLayouts.map((layout) => (
                              <tr key={layout.id}>
                                <td>{layout.id}</td>
                                <td>{layout.name}</td>
                                <td>
                                  {layout.ownerUsername || 'Unknown'} ·{' '}
                                  {layout.ownerEmail || `User ${layout.userId}`}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="admin-delete-button"
                                    onClick={() =>
                                      handleDeleteAdminLayout(layout.id)
                                    }
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </section>
            ) : (
              <TilePreview
                userId={currentUser.id}
                authToken={currentUser.token}
                onAuthExpired={handleAuthExpired}
                onSaveLayout={saveLayout}
              />
            )}

            {showDeleteAccountDialog && (
              <div className="confirm-overlay">
                <div className="confirm-dialog">
                  <form onSubmit={handleDeleteAccount}>
                    <p>
                      This will delete your account. Your layouts, uploaded tile
                      metadata, and uploaded image files will be retained.
                    </p>

                    <label
                      className="layout-name-label"
                      htmlFor="delete-account-password"
                    >
                      Confirm password
                    </label>
                    <div className="password-input-wrapper">
                      <input
                        id="delete-account-password"
                        className="layout-name-input password-input"
                        type={showDeleteAccountPassword ? 'text' : 'password'}
                        value={deleteAccountPassword}
                        onChange={(event) =>
                          setDeleteAccountPassword(event.target.value)
                        }
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="password-toggle-button"
                        aria-label={
                          showDeleteAccountPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        onClick={() =>
                          setShowDeleteAccountPassword(
                            (currentShowPassword) => !currentShowPassword,
                          )
                        }
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          focusable="false"
                        >
                          <path d="M12 5C6.8 5 3 12 3 12s3.8 7 9 7 9-7 9-7-3.8-7-9-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
                        </svg>
                      </button>
                    </div>

                    <label
                      className="layout-name-label"
                      htmlFor="delete-account-confirmation"
                    >
                      Type DELETE
                    </label>
                    <input
                      id="delete-account-confirmation"
                      className="layout-name-input"
                      value={deleteAccountConfirmation}
                      onChange={(event) =>
                        setDeleteAccountConfirmation(event.target.value)
                      }
                    />

                    {deleteAccountStatus && (
                      <p className="status-message">{deleteAccountStatus}</p>
                    )}

                    <div className="confirm-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={handleCancelDeleteAccount}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="control-button danger-control-button"
                      >
                        Delete Account
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="login-panel">
            <p className="section-label">
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </p>
            <h2>
              {authMode === 'login'
                ? 'Sign in to manage layouts'
                : 'Create an account'}
            </h2>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin}>
                <label className="layout-name-label" htmlFor="login-identifier">
                  Username or email
                </label>
                <input
                  id="login-identifier"
                  className="layout-name-input"
                  value={loginIdentifier}
                  onChange={(event) => setLoginIdentifier(event.target.value)}
                  autoComplete="username"
                />

                <label className="layout-name-label" htmlFor="login-password">
                  Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="login-password"
                    className="layout-name-input password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-button"
                    aria-label={
                      showLoginPassword ? 'Hide password' : 'Show password'
                    }
                    onClick={() =>
                      setShowLoginPassword(
                        (currentShowPassword) => !currentShowPassword,
                      )
                    }
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      focusable="false"
                    >
                      <path d="M12 5C6.8 5 3 12 3 12s3.8 7 9 7 9-7 9-7-3.8-7-9-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
                    </svg>
                  </button>
                </div>

                {loginStatus && <p className="status-message">{loginStatus}</p>}

                <button type="submit" className="control-button">
                  Login
                </button>

                <button
                  type="button"
                  className="auth-mode-button"
                  onClick={() => handleAuthModeChange('register')}
                >
                  Create account
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <label className="layout-name-label" htmlFor="register-username">
                  Username
                </label>
                <input
                  id="register-username"
                  className="layout-name-input"
                  value={registerUsername}
                  onChange={(event) => setRegisterUsername(event.target.value)}
                  autoComplete="username"
                />

                <label className="layout-name-label" htmlFor="register-email">
                  Email
                </label>
                <input
                  id="register-email"
                  className="layout-name-input"
                  type="email"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  autoComplete="email"
                />

                <label className="layout-name-label" htmlFor="register-password">
                  Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="register-password"
                    className="layout-name-input password-input"
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(event) =>
                      setRegisterPassword(event.target.value)
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-button"
                    aria-label={
                      showRegisterPassword ? 'Hide password' : 'Show password'
                    }
                    onClick={() =>
                      setShowRegisterPassword(
                        (currentShowPassword) => !currentShowPassword,
                      )
                    }
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      focusable="false"
                    >
                      <path d="M12 5C6.8 5 3 12 3 12s3.8 7 9 7 9-7 9-7-3.8-7-9-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
                    </svg>
                  </button>
                </div>

                <label
                  className="layout-name-label"
                  htmlFor="register-confirm-password"
                >
                  Confirm password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="register-confirm-password"
                    className="layout-name-input password-input"
                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                    value={registerConfirmPassword}
                    onChange={(event) =>
                      setRegisterConfirmPassword(event.target.value)
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-button"
                    aria-label={
                      showRegisterConfirmPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    onClick={() =>
                      setShowRegisterConfirmPassword(
                        (currentShowPassword) => !currentShowPassword,
                      )
                    }
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      focusable="false"
                    >
                      <path d="M12 5C6.8 5 3 12 3 12s3.8 7 9 7 9-7 9-7-3.8-7-9-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
                    </svg>
                  </button>
                </div>

                {loginStatus && <p className="status-message">{loginStatus}</p>}

                <button type="submit" className="control-button">
                  Create Account
                </button>

                <button
                  type="button"
                  className="auth-mode-button"
                  onClick={() => handleAuthModeChange('login')}
                >
                  Sign in instead
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <footer className="footer">
        Created by Eric Adams • Tile Pattern Generator Prototype
      </footer>
    </div>
  );
}

export default App;

import { useCallback, useState } from 'react';
import './App.css';
import AuthLanding from './components/AuthLanding';
import TilePreview from './TilePreview';

const API_BASE_URL = 'http://localhost:3001';
const CURRENT_USER_STORAGE_KEY = 'tilePatternCurrentUser';
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{5,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_USERS_PER_PAGE = 10;
const ADMIN_LAYOUTS_PER_PAGE = 10;

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

async function readApiResponse(response) {
  const body = await response.text();

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return { error: body };
  }
}

function getPaginatedItems(items, page, itemsPerPage) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  return {
    items: items.slice(startIndex, endIndex),
    currentPage,
    totalPages,
    totalItems,
    startItem: totalItems === 0 ? 0 : startIndex + 1,
    endItem: endIndex,
  };
}

function getCompactPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages]);
  const nearStart = currentPage <= 4;
  const nearEnd = currentPage >= totalPages - 3;

  if (nearStart) {
    for (let page = 2; page <= 5; page += 1) {
      pages.add(page);
    }
  } else if (nearEnd) {
    for (let page = totalPages - 4; page < totalPages; page += 1) {
      pages.add(page);
    }
  } else {
    pages.add(currentPage - 1);
    pages.add(currentPage);
    pages.add(currentPage + 1);
  }

  const sortedPages = [...pages].sort((a, b) => a - b);
  const compactItems = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      compactItems.push(`ellipsis-${previousPage}-${page}`);
    }

    compactItems.push(page);
  });

  return compactItems;
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
  const [activeAdminTab, setActiveAdminTab] = useState('activeUsers');
  const [activeUsersPage, setActiveUsersPage] = useState(1);
  const [deletedUsersPage, setDeletedUsersPage] = useState(1);
  const [layoutsPage, setLayoutsPage] = useState(1);

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentUser.token}`,
    };
  }

  const resetAdminPagination = useCallback(() => {
    setActiveUsersPage(1);
    setDeletedUsersPage(1);
    setLayoutsPage(1);
  }, []);

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
      return data;
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
      setActiveAdminTab('activeUsers');
      resetAdminPagination();
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
    setActiveAdminTab('activeUsers');
    resetAdminPagination();
  }, [resetAdminPagination]);

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
      setActiveAdminTab('activeUsers');
      resetAdminPagination();
    } catch (error) {
      console.error('Account deletion failed:', error);
      setDeleteAccountStatus('Could not connect to delete account.');
    }
  };

  const fetchAdminDashboard = async ({ resetPagination = false } = {}) => {
    if (!currentUser || currentUser.role !== 'admin') {
      setAdminStatus('Access Denied');
      return false;
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
        return false;
      }

      if (!layoutsResponse.ok) {
        setAdminStatus(layoutsData.error || 'Could not load admin layouts.');
        return false;
      }

      setAdminUsers(Array.isArray(usersData) ? usersData : []);
      setAdminLayouts(Array.isArray(layoutsData) ? layoutsData : []);
      if (resetPagination) {
        resetAdminPagination();
      }
      return true;
    } catch (error) {
      console.error('Admin dashboard fetch failed:', error);
      setAdminStatus('Could not connect to admin dashboard.');
      return false;
    }
  };

  const handleOpenAdminDashboard = () => {
    setActiveView('admin');
    setActiveAdminTab('activeUsers');
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

  const handleDeleteAdminUser = async (user) => {
    if (!currentUser || currentUser.role !== 'admin') {
      setAdminStatus('Access Denied');
      return;
    }

    if (Number(user.id) === Number(currentUser.id)) {
      setAdminStatus('Use Delete Account to delete your own signed-in account.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this user account?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await readApiResponse(response);

      if (!response.ok) {
        setAdminStatus(data.error || 'Could not delete user account.');
        return;
      }

      const deletedUser = data.user;
      setAdminUsers((currentUsers) =>
        currentUsers.map((currentAdminUser) =>
          Number(currentAdminUser.id) === Number(user.id)
            ? {
                ...currentAdminUser,
                deleted_at:
                  deletedUser?.deleted_at || new Date().toISOString(),
              }
            : currentAdminUser,
        ),
      );
      const refreshed = await fetchAdminDashboard();
      if (!refreshed) {
        return;
      }

      setAdminStatus('User account deleted.');
    } catch (error) {
      console.error('Admin user delete failed:', error);
      setAdminStatus('Could not connect to delete user account.');
    }
  };

  const activeAdminUsers = adminUsers.filter((user) => !user.deleted_at);
  const deletedAdminUsers = adminUsers.filter((user) => Boolean(user.deleted_at));
  const activeUsersPagination = getPaginatedItems(
    activeAdminUsers,
    activeUsersPage,
    ADMIN_USERS_PER_PAGE,
  );
  const deletedUsersPagination = getPaginatedItems(
    deletedAdminUsers,
    deletedUsersPage,
    ADMIN_USERS_PER_PAGE,
  );
  const layoutsPagination = getPaginatedItems(
    adminLayouts,
    layoutsPage,
    ADMIN_LAYOUTS_PER_PAGE,
  );

  const renderAdminPagination = (pagination, itemLabel, setPage) => (
    <div className="admin-pagination">
      <p className="admin-pagination-summary">
        {pagination.totalItems === 0
          ? `Showing 0 of 0 ${itemLabel}`
          : `Showing ${pagination.startItem}-${pagination.endItem} of ${pagination.totalItems} ${itemLabel}`}
      </p>
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-pagination-button"
          disabled={pagination.currentPage === 1}
          onClick={() =>
            setPage((currentPage) => Math.max(1, currentPage - 1))
          }
        >
          Previous
        </button>
        <div className="admin-pagination-pages" aria-label="Page navigation">
          {getCompactPageItems(
            pagination.currentPage,
            pagination.totalPages,
          ).map((pageItem) => {
            if (typeof pageItem === 'string') {
              return (
                <span
                  key={pageItem}
                  className="admin-pagination-ellipsis"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            return (
              <button
                key={pageItem}
                type="button"
                className={
                  pageItem === pagination.currentPage
                    ? 'admin-pagination-button admin-pagination-number active'
                    : 'admin-pagination-button admin-pagination-number'
                }
                aria-current={
                  pageItem === pagination.currentPage ? 'page' : undefined
                }
                onClick={() => setPage(pageItem)}
              >
                {pageItem}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="admin-pagination-button"
          disabled={pagination.currentPage === pagination.totalPages}
          onClick={() =>
            setPage((currentPage) =>
              Math.min(pagination.totalPages, currentPage + 1),
            )
          }
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={currentUser ? 'app-container' : 'app-container auth-app-container'}
    >
      <div
        className={currentUser ? 'app-shell' : 'app-shell auth-app-shell'}
      >
        {currentUser && <h1>Tile Pattern Generator</h1>}

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
                        onClick={() =>
                          fetchAdminDashboard({ resetPagination: true })
                        }
                      >
                        Refresh
                      </button>
                    </div>

                    {adminStatus && (
                      <p className="status-message">{adminStatus}</p>
                    )}

                    <div className="admin-tabs" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeAdminTab === 'activeUsers'}
                        className={
                          activeAdminTab === 'activeUsers'
                            ? 'admin-tab active'
                            : 'admin-tab'
                        }
                        onClick={() => setActiveAdminTab('activeUsers')}
                      >
                        Active Users
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeAdminTab === 'deletedUsers'}
                        className={
                          activeAdminTab === 'deletedUsers'
                            ? 'admin-tab active'
                            : 'admin-tab'
                        }
                        onClick={() => setActiveAdminTab('deletedUsers')}
                      >
                        Deleted Users
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeAdminTab === 'layouts'}
                        className={
                          activeAdminTab === 'layouts'
                            ? 'admin-tab active'
                            : 'admin-tab'
                        }
                        onClick={() => setActiveAdminTab('layouts')}
                      >
                        Layouts
                      </button>
                    </div>

                    {activeAdminTab === 'activeUsers' && (
                      <div className="admin-section" role="tabpanel">
                        <h3>Active Users</h3>
                        <div className="admin-table-wrapper">
                          <table className="admin-table admin-users-table">
                            <thead>
                              <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeUsersPagination.items.map((user) => (
                                <tr key={user.id}>
                                  <td>{user.username}</td>
                                  <td>{user.email}</td>
                                  <td>{user.role}</td>
                                  <td>
                                    {user.deleted_at ? 'Deleted' : 'Active'}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="admin-delete-button"
                                      disabled={Boolean(user.deleted_at)}
                                      onClick={() =>
                                        handleDeleteAdminUser(user)
                                      }
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {activeUsersPagination.totalItems === 0 && (
                                <tr>
                                  <td colSpan="5" className="admin-empty-cell">
                                    No active users found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {renderAdminPagination(
                          activeUsersPagination,
                          'active users',
                          setActiveUsersPage,
                        )}
                      </div>
                    )}

                    {activeAdminTab === 'deletedUsers' && (
                      <div className="admin-section" role="tabpanel">
                        <h3>Deleted Users</h3>
                        <div className="admin-table-wrapper">
                          <table className="admin-table admin-users-table">
                            <thead>
                              <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {deletedUsersPagination.items.map((user) => (
                                <tr key={user.id}>
                                  <td>{user.username}</td>
                                  <td>{user.email}</td>
                                  <td>{user.role}</td>
                                  <td>
                                    {user.deleted_at ? 'Deleted' : 'Active'}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="admin-reactivate-placeholder"
                                      disabled
                                    >
                                      <span>Reactivate</span>
                                      <small>Future Release</small>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {deletedUsersPagination.totalItems === 0 && (
                                <tr>
                                  <td colSpan="5" className="admin-empty-cell">
                                    No deleted users found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {renderAdminPagination(
                          deletedUsersPagination,
                          'deleted users',
                          setDeletedUsersPage,
                        )}
                      </div>
                    )}

                    {activeAdminTab === 'layouts' && (
                      <div className="admin-section" role="tabpanel">
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
                              {layoutsPagination.items.map((layout) => (
                                <tr key={layout.id}>
                                  <td>{layout.id}</td>
                                  <td>{layout.name}</td>
                                  <td>
                                    {layout.ownerUsername || 'Unknown'} ·{' '}
                                    {layout.ownerEmail ||
                                      `User ${layout.userId}`}
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
                              {layoutsPagination.totalItems === 0 && (
                                <tr>
                                  <td colSpan="4" className="admin-empty-cell">
                                    No layouts found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {renderAdminPagination(
                          layoutsPagination,
                          'layouts',
                          setLayoutsPage,
                        )}
                      </div>
                    )}
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
          <AuthLanding
            authMode={authMode}
            loginIdentifier={loginIdentifier}
            loginPassword={loginPassword}
            loginStatus={loginStatus}
            registerUsername={registerUsername}
            registerEmail={registerEmail}
            registerPassword={registerPassword}
            registerConfirmPassword={registerConfirmPassword}
            showLoginPassword={showLoginPassword}
            showRegisterPassword={showRegisterPassword}
            showRegisterConfirmPassword={showRegisterConfirmPassword}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onAuthModeChange={handleAuthModeChange}
            onLoginIdentifierChange={setLoginIdentifier}
            onLoginPasswordChange={setLoginPassword}
            onRegisterUsernameChange={setRegisterUsername}
            onRegisterEmailChange={setRegisterEmail}
            onRegisterPasswordChange={setRegisterPassword}
            onRegisterConfirmPasswordChange={setRegisterConfirmPassword}
            onToggleLoginPassword={() =>
              setShowLoginPassword(
                (currentShowPassword) => !currentShowPassword,
              )
            }
            onToggleRegisterPassword={() =>
              setShowRegisterPassword(
                (currentShowPassword) => !currentShowPassword,
              )
            }
            onToggleRegisterConfirmPassword={() =>
              setShowRegisterConfirmPassword(
                (currentShowPassword) => !currentShowPassword,
              )
            }
          />
        )}
      </div>

      {currentUser && (
        <footer className="footer">
          Created by Eric Adams • Tile Pattern Generator Prototype
        </footer>
      )}
    </div>
  );
}

export default App;

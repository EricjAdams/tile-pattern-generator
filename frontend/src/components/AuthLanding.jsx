import { useEffect, useRef } from 'react';
import './AuthLanding.css';

const TILE_PALETTE = [
  '#2c2c2a',
  '#3a3835',
  '#4a4740',
  '#5c574e',
  '#6b6257',
  '#7a7268',
  '#8b8278',
  '#9b9287',
  '#b0a898',
  '#c8c0b0',
  '#d8d2c8',
  '#e8e4dc',
];

function PasswordToggleButton({ isVisible, onToggle }) {
  return (
    <button
      type="button"
      className="auth-landing-password-toggle"
      aria-label={isVisible ? 'Hide password' : 'Show password'}
      onClick={onToggle}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M12 5C6.8 5 3 12 3 12s3.8 7 9 7 9-7 9-7-3.8-7-9-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
      </svg>
    </button>
  );
}

function AuthLanding({
  authMode,
  loginIdentifier,
  loginPassword,
  loginStatus,
  registerUsername,
  registerEmail,
  registerPassword,
  registerConfirmPassword,
  showLoginPassword,
  showRegisterPassword,
  showRegisterConfirmPassword,
  onLogin,
  onRegister,
  onAuthModeChange,
  onLoginIdentifierChange,
  onLoginPasswordChange,
  onRegisterUsernameChange,
  onRegisterEmailChange,
  onRegisterPasswordChange,
  onRegisterConfirmPasswordChange,
  onToggleLoginPassword,
  onToggleRegisterPassword,
  onToggleRegisterConfirmPassword,
}) {
  const canvasRef = useRef(null);
  const isLoginMode = authMode === 'login';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const tileSize = 46;
    const gap = 4;
    const step = tileSize + gap;
    const columns = 16;
    const visibleColumns = 15.69;
    const rows = 10;
    let frameId;
    let lastShift = 0;
    const tiles = Array.from({ length: columns * rows }, (_, index) => ({
      x: index % columns,
      y: Math.floor(index / columns),
      colorIndex: (index * 3 + Math.floor(index / columns)) % TILE_PALETTE.length,
    }));

    const resizeCanvas = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      const width = visibleColumns * step;
      const height = rows * step;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (timestamp) => {
      if (!lastShift || timestamp - lastShift > 1050) {
        lastShift = timestamp;
        tiles.forEach((tile, index) => {
          if ((index + Math.floor(timestamp / 1050)) % 5 === 0) {
            tile.colorIndex = (tile.colorIndex + 2) % TILE_PALETTE.length;
          }
        });
      }

      context.clearRect(
        0,
        0,
        visibleColumns * step,
        rows * step,
      );
      tiles.forEach((tile) => {
        context.fillStyle = TILE_PALETTE[tile.colorIndex];
        context.globalAlpha = 0.24 + (tile.colorIndex / TILE_PALETTE.length) * 0.42;
        context.fillRect(tile.x * step, tile.y * step, tileSize, tileSize);
      });
      context.globalAlpha = 1;
      frameId = window.requestAnimationFrame(draw);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    frameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <main className="auth-landing">
      <canvas
        ref={canvasRef}
        className="auth-landing-tile-accent"
        aria-hidden="true"
      />

      <section className="auth-landing-content" aria-labelledby="auth-heading">
        <p className="auth-landing-eyebrow">Tile Pattern Generator</p>
        <h1 id="auth-heading" className="auth-landing-title">
          <span className="auth-landing-title-main">Design your space,</span>
          <span className="auth-landing-title-accent">tile by tile.</span>
        </h1>
        <p className="auth-landing-copy">
          Visualize custom tile layouts before a single piece is cut.
          <br />
          <br />
          Upload your tiles, paint the grid, save your designs.
        </p>

        <div className="auth-landing-card">
          <p className="auth-landing-card-label">
            {isLoginMode ? 'Sign in' : 'Create account'}
          </p>

          {isLoginMode ? (
            <form className="auth-landing-form" onSubmit={onLogin}>
              <label className="auth-landing-label" htmlFor="login-identifier">
                Username or email
              </label>
              <input
                id="login-identifier"
                className="auth-landing-input"
                value={loginIdentifier}
                onChange={(event) => onLoginIdentifierChange(event.target.value)}
                autoComplete="username"
                placeholder="studio@example.com"
              />

              <label className="auth-landing-label" htmlFor="login-password">
                Password
              </label>
              <div className="auth-landing-password-field">
                <input
                  id="login-password"
                  className="auth-landing-input auth-landing-password-input"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(event) => onLoginPasswordChange(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
                <PasswordToggleButton
                  isVisible={showLoginPassword}
                  onToggle={onToggleLoginPassword}
                />
              </div>

              {loginStatus && (
                <p className="auth-landing-status">{loginStatus}</p>
              )}

              <button type="submit" className="auth-landing-submit">
                Sign in
              </button>

              <div className="auth-landing-divider">
                <span>new here?</span>
              </div>

              <button
                type="button"
                className="auth-landing-mode-button"
                onClick={() => onAuthModeChange('register')}
              >
                Create a free account
              </button>
            </form>
          ) : (
            <form className="auth-landing-form" onSubmit={onRegister}>
              <label className="auth-landing-label" htmlFor="register-username">
                Username
              </label>
              <input
                id="register-username"
                className="auth-landing-input"
                value={registerUsername}
                onChange={(event) =>
                  onRegisterUsernameChange(event.target.value)
                }
                autoComplete="username"
                placeholder="designstudio"
              />

              <label className="auth-landing-label" htmlFor="register-email">
                Email
              </label>
              <input
                id="register-email"
                className="auth-landing-input"
                type="email"
                value={registerEmail}
                onChange={(event) => onRegisterEmailChange(event.target.value)}
                autoComplete="email"
                placeholder="studio@example.com"
              />

              <label className="auth-landing-label" htmlFor="register-password">
                Password
              </label>
              <div className="auth-landing-password-field">
                <input
                  id="register-password"
                  className="auth-landing-input auth-landing-password-input"
                  type={showRegisterPassword ? 'text' : 'password'}
                  value={registerPassword}
                  onChange={(event) =>
                    onRegisterPasswordChange(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Create a secure password"
                />
                <PasswordToggleButton
                  isVisible={showRegisterPassword}
                  onToggle={onToggleRegisterPassword}
                />
              </div>

              <label
                className="auth-landing-label"
                htmlFor="register-confirm-password"
              >
                Confirm password
              </label>
              <div className="auth-landing-password-field">
                <input
                  id="register-confirm-password"
                  className="auth-landing-input auth-landing-password-input"
                  type={showRegisterConfirmPassword ? 'text' : 'password'}
                  value={registerConfirmPassword}
                  onChange={(event) =>
                    onRegisterConfirmPasswordChange(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                />
                <PasswordToggleButton
                  isVisible={showRegisterConfirmPassword}
                  onToggle={onToggleRegisterConfirmPassword}
                />
              </div>

              {loginStatus && (
                <p className="auth-landing-status">{loginStatus}</p>
              )}

              <button type="submit" className="auth-landing-submit">
                Create account
              </button>

              <div className="auth-landing-divider">
                <span>already registered?</span>
              </div>

              <button
                type="button"
                className="auth-landing-mode-button"
                onClick={() => onAuthModeChange('login')}
              >
                Already have an account? Sign in
              </button>
            </form>
          )}
        </div>

        <dl className="auth-landing-stats" aria-label="Product highlights">
          <div>
            <dt>∞</dt>
            <dd>Layouts</dd>
          </div>
          <div>
            <dt>Any</dt>
            <dd>Tile Type</dd>
          </div>
          <div>
            <dt>Live</dt>
            <dd>Preview</dd>
          </div>
        </dl>
      </section>

      <footer className="auth-landing-footer">
        Created by Eric Adams • Tile Pattern Generator Prototype
      </footer>
    </main>
  );
}

export default AuthLanding;

/**
 * Clerk Authentication for Electron Desktop App
 *
 * Uses OAuth popup flow with Clerk's hosted login page.
 * Stores session token securely using Electron's safeStorage.
 */

const { BrowserWindow, safeStorage, session } = require('electron');
const { EventEmitter } = require('events');
require('dotenv').config();

const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;
const CLERK_FRONTEND_API = process.env.CLERK_FRONTEND_API; // e.g., 'clerk.your-domain.com' or 'your-app.clerk.accounts.dev'

// Token storage key
const TOKEN_STORAGE_KEY = 'brain-clerk-session';

class ClerkAuth extends EventEmitter {
  constructor() {
    super();
    this.sessionToken = null;
    this.user = null;
    this.authWindow = null;
  }

  /**
   * Initialize auth - try to restore session from secure storage
   */
  async initialize() {
    if (!CLERK_PUBLISHABLE_KEY || !CLERK_FRONTEND_API) {
      console.warn('[Auth] Clerk not configured. Set CLERK_PUBLISHABLE_KEY and CLERK_FRONTEND_API in .env');
      return false;
    }

    try {
      // Try to restore saved session
      const savedToken = this.loadToken();
      if (savedToken) {
        // Validate the token is still valid
        const isValid = await this.validateToken(savedToken);
        if (isValid) {
          this.sessionToken = savedToken;
          console.log('[Auth] Restored session from secure storage');
          this.emit('authenticated', { token: savedToken });
          return true;
        } else {
          console.log('[Auth] Saved session expired, clearing');
          this.clearToken();
        }
      }
    } catch (error) {
      console.error('[Auth] Failed to restore session:', error);
    }

    return false;
  }

  /**
   * Open Clerk login in a popup window
   */
  async login() {
    if (!CLERK_PUBLISHABLE_KEY || !CLERK_FRONTEND_API) {
      throw new Error('Clerk not configured');
    }

    return new Promise((resolve, reject) => {
      // Create auth popup window
      this.authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
        title: 'Sign in to Brain',
      });

      // Clerk sign-in URL
      const signInUrl = `https://${CLERK_FRONTEND_API}/sign-in?redirect_url=${encodeURIComponent('https://brain-desktop.local/auth/callback')}`;

      console.log('[Auth] Opening sign-in URL:', signInUrl);
      this.authWindow.loadURL(signInUrl);

      // Listen for navigation to callback URL
      this.authWindow.webContents.on('will-redirect', async (event, url) => {
        console.log('[Auth] Redirect to:', url);

        if (url.startsWith('https://brain-desktop.local/auth/callback')) {
          event.preventDefault();

          // Extract session from cookies
          try {
            const cookies = await session.defaultSession.cookies.get({
              domain: CLERK_FRONTEND_API.replace('clerk.', '.'),
            });

            const sessionCookie = cookies.find(c => c.name === '__session');
            if (sessionCookie) {
              this.sessionToken = sessionCookie.value;
              this.saveToken(this.sessionToken);
              this.emit('authenticated', { token: this.sessionToken });
              this.authWindow.close();
              resolve({ token: this.sessionToken });
            } else {
              reject(new Error('No session cookie found'));
            }
          } catch (error) {
            reject(error);
          }
        }
      });

      // Also check on page load (some flows don't redirect)
      this.authWindow.webContents.on('did-navigate', async (event, url) => {
        console.log('[Auth] Navigated to:', url);

        // Check if we're on a success page or have a session
        if (url.includes('/sign-in/sso-callback') || url.includes('/sign-in/verify')) {
          // Wait a moment for session to be set
          setTimeout(async () => {
            try {
              const cookies = await session.defaultSession.cookies.get({});
              const sessionCookie = cookies.find(c => c.name === '__session');

              if (sessionCookie) {
                this.sessionToken = sessionCookie.value;
                this.saveToken(this.sessionToken);
                this.emit('authenticated', { token: this.sessionToken });
                this.authWindow.close();
                resolve({ token: this.sessionToken });
              }
            } catch (error) {
              console.error('[Auth] Error checking session:', error);
            }
          }, 1000);
        }
      });

      this.authWindow.on('closed', () => {
        this.authWindow = null;
        if (!this.sessionToken) {
          reject(new Error('Auth window closed without completing login'));
        }
      });
    });
  }

  /**
   * Validate a session token with Clerk
   */
  async validateToken(token) {
    try {
      // Decode JWT to check expiration (basic check)
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const exp = payload.exp * 1000;

      if (Date.now() >= exp) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Auth] Token validation error:', error);
      return false;
    }
  }

  /**
   * Get the current session token
   */
  getToken() {
    return this.sessionToken;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.sessionToken;
  }

  /**
   * Log out and clear session
   */
  logout() {
    this.sessionToken = null;
    this.user = null;
    this.clearToken();

    // Clear Clerk cookies
    session.defaultSession.clearStorageData({
      storages: ['cookies'],
    });

    this.emit('logout');
    console.log('[Auth] Logged out');
  }

  /**
   * Save token to secure storage
   */
  saveToken(token) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token);
        // Store encrypted buffer as base64 in a file or electron-store
        // For simplicity, we'll use a global variable (in production, use electron-store)
        global.encryptedToken = encrypted.toString('base64');
        console.log('[Auth] Token saved to secure storage');
      } else {
        console.warn('[Auth] Secure storage not available');
      }
    } catch (error) {
      console.error('[Auth] Failed to save token:', error);
    }
  }

  /**
   * Load token from secure storage
   */
  loadToken() {
    try {
      if (safeStorage.isEncryptionAvailable() && global.encryptedToken) {
        const encrypted = Buffer.from(global.encryptedToken, 'base64');
        return safeStorage.decryptString(encrypted);
      }
    } catch (error) {
      console.error('[Auth] Failed to load token:', error);
    }
    return null;
  }

  /**
   * Clear stored token
   */
  clearToken() {
    global.encryptedToken = null;
  }
}

// Singleton instance
const auth = new ClerkAuth();

module.exports = {
  auth,
  ClerkAuth,
};

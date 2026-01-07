/**
 * Clerk Authentication for Electron Desktop App
 *
 * Uses OAuth popup flow with Clerk's hosted login page.
 * Stores session token securely using Electron's safeStorage and electron-store.
 */

const { BrowserWindow, safeStorage, session } = require("electron");
const { EventEmitter } = require("events");
const Store = require("electron-store");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
require("dotenv").config();

const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;
const CLERK_FRONTEND_API = process.env.CLERK_FRONTEND_API; // e.g., 'clerk.your-domain.com' or 'your-app.clerk.accounts.dev'

// JWKS client for fetching Clerk's public keys to verify JWT signatures
const jwksClientInstance = CLERK_FRONTEND_API
  ? jwksClient({
      jwksUri: `https://${CLERK_FRONTEND_API}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
    })
  : null;

// Token storage key
const TOKEN_STORAGE_KEY = "encryptedToken";

// Initialize electron-store for persistent storage
const store = new Store({
  name: "brain-auth",
});

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
      console.warn(
        "[Auth] Clerk not configured. Set CLERK_PUBLISHABLE_KEY and CLERK_FRONTEND_API in .env",
      );
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
          console.log("[Auth] Restored session from secure storage");
          this.emit("authenticated", { token: savedToken });
          return true;
        } else {
          console.log("[Auth] Saved session expired, clearing");
          this.clearToken();
        }
      }
    } catch (error) {
      console.error("[Auth] Failed to restore session:", error);
    }

    return false;
  }

  /**
   * Open Clerk login in a popup window
   */
  async login() {
    if (!CLERK_PUBLISHABLE_KEY || !CLERK_FRONTEND_API) {
      throw new Error("Clerk not configured");
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
        title: "Sign in to Brain",
      });

      // Clerk sign-in URL
      const signInUrl = `https://${CLERK_FRONTEND_API}/sign-in?redirect_url=${encodeURIComponent("https://brain-desktop.local/auth/callback")}`;

      console.log("[Auth] Opening sign-in URL:", signInUrl);
      this.authWindow.loadURL(signInUrl);

      // Listen for navigation to callback URL
      this.authWindow.webContents.on("will-redirect", async (event, url) => {
        console.log("[Auth] Redirect to:", url);

        if (url.startsWith("https://brain-desktop.local/auth/callback")) {
          event.preventDefault();

          // Extract session from cookies
          try {
            const cookies = await session.defaultSession.cookies.get({
              domain: CLERK_FRONTEND_API.replace("clerk.", "."),
            });

            const sessionCookie = cookies.find((c) => c.name === "__session");
            if (sessionCookie) {
              this.sessionToken = sessionCookie.value;
              this.saveToken(this.sessionToken);
              this.emit("authenticated", { token: this.sessionToken });
              this.authWindow.close();
              resolve({ token: this.sessionToken });
            } else {
              reject(new Error("No session cookie found"));
            }
          } catch (error) {
            reject(error);
          }
        }
      });

      // Also check on page load (some flows don't redirect)
      this.authWindow.webContents.on("did-navigate", async (event, url) => {
        console.log("[Auth] Navigated to:", url);

        // Check if we're on a success page or have a session
        if (
          url.includes("/sign-in/sso-callback") ||
          url.includes("/sign-in/verify")
        ) {
          // Wait a moment for session to be set
          setTimeout(async () => {
            try {
              const cookies = await session.defaultSession.cookies.get({});
              const sessionCookie = cookies.find((c) => c.name === "__session");

              if (sessionCookie) {
                this.sessionToken = sessionCookie.value;
                this.saveToken(this.sessionToken);
                this.emit("authenticated", { token: this.sessionToken });
                this.authWindow.close();
                resolve({ token: this.sessionToken });
              }
            } catch (error) {
              console.error("[Auth] Error checking session:", error);
            }
          }, 1000);
        }
      });

      this.authWindow.on("closed", () => {
        this.authWindow = null;
        if (!this.sessionToken) {
          reject(new Error("Auth window closed without completing login"));
        }
      });
    });
  }

  /**
   * Get the signing key from JWKS for JWT verification
   */
  _getSigningKey(header, callback) {
    if (!jwksClientInstance) {
      return callback(new Error("JWKS client not initialized"));
    }

    jwksClientInstance.getSigningKey(header.kid, (err, key) => {
      if (err) {
        return callback(err);
      }
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    });
  }

  /**
   * Validate a session token by verifying its JWT signature with Clerk's JWKS
   */
  async validateToken(token) {
    // If JWKS client isn't available, fall back to basic expiration check
    if (!jwksClientInstance) {
      console.warn("[Auth] JWKS client not available, using basic validation");
      return this._basicTokenValidation(token);
    }

    return new Promise((resolve) => {
      jwt.verify(
        token,
        this._getSigningKey.bind(this),
        {
          algorithms: ["RS256"],
          issuer: `https://${CLERK_FRONTEND_API}`,
        },
        (err, decoded) => {
          if (err) {
            console.error("[Auth] Token validation error:", err.message);
            resolve(false);
          } else {
            console.log("[Auth] Token verified successfully");
            resolve(true);
          }
        },
      );
    });
  }

  /**
   * Basic token validation (expiration check only) - used as fallback
   */
  _basicTokenValidation(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return false;

      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
      const exp = payload.exp * 1000;

      if (Date.now() >= exp) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("[Auth] Basic token validation error:", error);
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
      storages: ["cookies"],
    });

    this.emit("logout");
    console.log("[Auth] Logged out");
  }

  /**
   * Save token to secure storage (persisted via electron-store)
   */
  saveToken(token) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token);
        const base64 = encrypted.toString("base64");
        store.set(TOKEN_STORAGE_KEY, base64);
        console.log("[Auth] Token saved to secure storage");
      } else {
        console.warn("[Auth] Secure storage not available");
      }
    } catch (error) {
      console.error("[Auth] Failed to save token:", error);
    }
  }

  /**
   * Load token from secure storage (persisted via electron-store)
   */
  loadToken() {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const base64 = store.get(TOKEN_STORAGE_KEY);
        if (base64) {
          const encrypted = Buffer.from(base64, "base64");
          return safeStorage.decryptString(encrypted);
        }
      }
    } catch (error) {
      console.error("[Auth] Failed to load token:", error);
    }
    return null;
  }

  /**
   * Clear stored token
   */
  clearToken() {
    store.delete(TOKEN_STORAGE_KEY);
  }
}

// Singleton instance
const auth = new ClerkAuth();

module.exports = {
  auth,
  ClerkAuth,
};

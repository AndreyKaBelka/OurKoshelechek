import type { AuthTokensFragment } from "./operations/auth.generated";

// Kept under the pre-refresh-token key so users already logged in keep their access
// token until it expires (they'll have no refresh token, so they re-login once).
const ACCESS_TOKEN_KEY = "vdvoem.auth.token";
const ACCESS_EXPIRES_AT_KEY = "vdvoem.auth.expiresAt";
const REFRESH_TOKEN_KEY = "vdvoem.auth.refreshToken";

/** Fired on `window` when the refresh token is rejected and the user must log in again. */
export const SESSION_EXPIRED_EVENT = "vdvoem:session-expired";

export interface Session {
  accessToken: string;
  /** Epoch ms after which the access token is no longer accepted (null if unknown). */
  accessExpiresAt: number | null;
  refreshToken: string | null;
}

// In-memory (per page load, deliberately not persisted): whether this launch of the app has
// already traded the refresh token for a new pair. Lets the client rotate it once on every
// app open, so the server-side 30-day lifetime counts from the last visit.
let sessionFresh = false;

export function isSessionFresh(): boolean {
  return sessionFresh;
}

export function markSessionFresh(): void {
  sessionFresh = true;
}

export function readSession(): Session | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;
  const expiresAt = Number(localStorage.getItem(ACCESS_EXPIRES_AT_KEY));
  return {
    accessToken,
    accessExpiresAt: expiresAt > 0 ? expiresAt : null,
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function saveSession(tokens: AuthTokensFragment): void {
  sessionFresh = true;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(ACCESS_EXPIRES_AT_KEY, String(Date.now() + tokens.expiresIn * 1000));
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_EXPIRES_AT_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

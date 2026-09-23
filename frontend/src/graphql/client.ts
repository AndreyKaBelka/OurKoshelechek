import { Client, cacheExchange, fetchExchange, type CombinedError } from "urql";
import { authExchange } from "@urql/exchange-auth";
import { refocusExchange } from "@urql/exchange-refocus";
import {
  RefreshTokenDocument,
  type RefreshTokenMutation,
  type RefreshTokenMutationVariables,
} from "./operations/auth.generated";
import { SESSION_EXPIRED_EVENT, clearSession, isSessionFresh, markSessionFresh, readSession, saveSession } from "./session";

// "/query" is same-origin in both dev (proxied to the backend by vite.config.ts)
// and prod (proxied by nginx, see frontend/nginx.conf).
const API_URL = import.meta.env.VITE_API_URL ?? "/query";

// Refresh this long before the access token actually expires, so a request never
// leaves with a token that dies in flight.
const EXPIRY_MARGIN_MS = 30_000;

export function isUnauthenticated(error: CombinedError): boolean {
  return error.graphQLErrors.some((e) => e.extensions?.code === "UNAUTHENTICATED");
}

// Short-lived access tokens are renewed transparently: before the first request of every app
// launch (this rotates the refresh token, restarting its 30-day lifetime — so the user is only
// logged out after 30 days without opening the app), before a request if the stored one is
// about to expire, or after a request fails with UNAUTHENTICATED (the failed
// operation is then retried once with the new token).
function createAuthExchange() {
  return authExchange(async (utils) => ({
    addAuthToOperation(operation) {
      const session = readSession();
      return session ? utils.appendHeaders(operation, { Authorization: `Bearer ${session.accessToken}` }) : operation;
    },
    willAuthError() {
      const session = readSession();
      if (!session?.refreshToken) return false;
      if (!isSessionFresh()) return true;
      return session.accessExpiresAt !== null && session.accessExpiresAt - EXPIRY_MARGIN_MS < Date.now();
    },
    didAuthError: isUnauthenticated,
    async refreshAuth() {
      const refreshToken = readSession()?.refreshToken;
      if (!refreshToken) return;

      // Marked before the call so a failed attempt (offline, other tab won the race) isn't
      // retried by every request; the expiry check above still covers later renewals.
      markSessionFresh();
      const result = await utils.mutate<RefreshTokenMutation, RefreshTokenMutationVariables>(RefreshTokenDocument, {
        refreshToken,
      });
      if (result.data) {
        saveSession(result.data.refreshToken);
        return;
      }
      // Refresh tokens are single-use, so another tab refreshing at the same moment makes
      // ours fail — that tab already stored a fresh pair we can just keep using.
      if (readSession()?.refreshToken !== refreshToken) return;
      // Only a rejected token ends the session; a network blip shouldn't log the user out.
      if (result.error?.graphQLErrors.length) {
        clearSession();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    },
  }));
}

// A fresh client (with an empty document cache) is created on every logout so the
// next user never sees data cached for the previous one.
export function createUrqlClient(): Client {
  return new Client({
    url: API_URL,
    // Refetches all active queries (network) whenever the tab/app regains visibility —
    // otherwise data added by another group member stays stale until a full reload,
    // which is the only way iOS "Add to Home Screen" users have to force a refresh.
    exchanges: [refocusExchange(), cacheExchange, createAuthExchange(), fetchExchange],
    preferGetMethod: false,
  });
}

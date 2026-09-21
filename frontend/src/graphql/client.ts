import { Client, cacheExchange, fetchExchange } from "urql";

// "/query" is same-origin in both dev (proxied to the backend by vite.config.ts)
// and prod (proxied by nginx, see frontend/nginx.conf).
const API_URL = import.meta.env.VITE_API_URL ?? "/query";

export const AUTH_STORAGE_KEY = "vdvoem.auth.token";

export const urqlClient = new Client({
  url: API_URL,
  exchanges: [cacheExchange, fetchExchange],
  preferGetMethod: false,
  fetchOptions: () => {
    const token = localStorage.getItem(AUTH_STORAGE_KEY);

    return token
        ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
        : {};
  },
});
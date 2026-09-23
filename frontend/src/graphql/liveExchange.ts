import type { Exchange, Operation } from "urql";
import { pipe, tap } from "wonka";

// How often active queries are refetched while the app is on screen, so a partner's changes
// show up without any user action.
const POLL_INTERVAL_MS = 30_000;
// Several resume events fire together (visibilitychange + pageshow + focus); refetch once.
const MIN_GAP_MS = 1_000;

// Keeps on-screen data fresh: refetches every active query (cache-and-network — stale data stays
// visible while the request is in flight) when the app comes back to the foreground and on a
// timer while it is visible. `visibilitychange` alone is not enough for iOS "Add to Home Screen"
// apps: resuming from the app switcher doesn't reliably fire it, hence pageshow/focus/online too.
export function liveExchange(): Exchange {
  return ({ client, forward }) =>
    (ops$) => {
      if (typeof window === "undefined") return forward(ops$);

      const watched = new Map<number, Operation>();
      let lastRefresh = 0;

      const refresh = () => {
        if (document.visibilityState !== "visible" || watched.size === 0) return;
        const now = Date.now();
        if (now - lastRefresh < MIN_GAP_MS) return;
        lastRefresh = now;
        watched.forEach((op) => {
          client.reexecuteOperation(
            client.createRequestOperation("query", op, { ...op.context, requestPolicy: "cache-and-network" }),
          );
        });
      };

      document.addEventListener("visibilitychange", refresh);
      window.addEventListener("pageshow", refresh);
      window.addEventListener("focus", refresh);
      window.addEventListener("online", refresh);
      window.setInterval(refresh, POLL_INTERVAL_MS);

      return forward(
        pipe(
          ops$,
          tap((op) => {
            if (op.kind === "query") watched.set(op.key, op);
            else if (op.kind === "teardown") watched.delete(op.key);
          }),
        ),
      );
    };
}

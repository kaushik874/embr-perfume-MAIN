import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * useScrollRestoration — globally resets scroll to the top on every new
 * page navigation.
 *
 * Strategy:
 *  - On every Wouter `location` change we check the browser's Navigation API
 *    (Chrome 102+) or the legacy `performance.getEntriesByType` to detect
 *    whether the navigation was triggered by a browser Back / Forward action.
 *  - If it is a back/forward traversal we leave the scroll position alone so
 *    the browser can restore it naturally.
 *  - For every other navigation type (link click, programmatic push, replace)
 *    we immediately call `window.scrollTo({ top: 0, left: 0, behavior: "instant" })`
 *    so the new page always opens from the top with no visible flicker.
 *
 * This hook must be mounted once at the top of the component tree (App.tsx).
 * It produces no DOM output and triggers no re-renders of its own.
 */
export function useScrollRestoration() {
  const [location] = useLocation();

  // Track the previous path so we only act on real route changes.
  const prevLocationRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip the very first mount — the browser already handles initial scroll.
    if (prevLocationRef.current === null) {
      prevLocationRef.current = location;
      return;
    }

    // No actual path change — nothing to do.
    if (prevLocationRef.current === location) {
      return;
    }

    prevLocationRef.current = location;

    // ── Detect back / forward traversal ─────────────────────────────────────
    // Modern browsers expose `navigation.currentEntry.key` and the
    // `navigationType` on the Navigation API (Chrome 102+).
    // For older browsers we fall back to `performance.getEntriesByType`.
    let isBackForward = false;

    try {
      // Navigation API (Chrome / Edge 102+, Safari 18+)
      const nav = (window as any).navigation;
      if (nav && nav.currentEntry) {
        // The navigation API fires *before* React re-renders when using
        // `navigate` events; but by the time useEffect runs the entry is
        // already updated.  We check the last recorded navigation type that
        // we stored in a module-level variable set by the `navigate` listener.
        isBackForward = _lastNavigationType === "traverse";
      }
    } catch {
      // ignore — API not available
    }

    if (!isBackForward) {
      try {
        // Legacy fallback: PerformanceNavigationTiming
        const entries = performance.getEntriesByType(
          "navigation"
        ) as PerformanceNavigationTiming[];
        if (entries.length > 0 && entries[0].type === "back_forward") {
          isBackForward = true;
        }
      } catch {
        // ignore
      }
    }

    if (!isBackForward) {
      // Scroll instantly to top — `behavior: "instant"` prevents any
      // visible smooth-scroll animation that could cause flicker.
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location]);
}

// ── Navigation API event listener (module-level, set up once) ────────────────
// We listen to the Navigation API `navigate` event to capture the navigation
// type *before* Wouter processes the URL change.  This lets the useEffect
// above query `_lastNavigationType` synchronously.
let _lastNavigationType: string = "push";

try {
  const nav = (window as any).navigation;
  if (nav) {
    nav.addEventListener("navigate", (event: any) => {
      _lastNavigationType = event.navigationType ?? "push";
    });
  }
} catch {
  // Navigation API not available — back/forward detection will rely on
  // PerformanceNavigationTiming only, which is accurate for hard navigations.
  // For SPA back/forward within the same session this means we will scroll to
  // top on back/forward as well, which is a safe, if slightly less ideal,
  // fallback.
}

import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * useScrollRestoration — saves scroll position per route and restores it on
 * back/forward navigation. For forward (push) navigations the page scrolls to top.
 *
 * Strategy:
 *  - On every route change we save the current scroll position of the
 *    *previous* route into sessionStorage.
 *  - If the navigation is a browser Back/Forward traversal we restore the
 *    saved scroll position for the new route (with a short RAF delay to let
 *    React render the content first).
 *  - For every other navigation type (link click, programmatic push) we
 *    scroll instantly to top.
 *
 * This hook must be mounted once at the top of the component tree (App.tsx).
 */

const SCROLL_KEY_PREFIX = "embr_scroll_";

function saveScroll(path: string) {
  try { sessionStorage.setItem(SCROLL_KEY_PREFIX + path, String(window.scrollY)); } catch {}
}

function getSavedScroll(path: string): number | null {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY_PREFIX + path);
    return v !== null ? Number(v) : null;
  } catch { return null; }
}

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

    // Save scroll position of the page we are *leaving*.
    saveScroll(prevLocationRef.current);

    prevLocationRef.current = location;

    // ── Detect back / forward traversal ─────────────────────────────────────
    let isBackForward = false;

    try {
      const nav = (window as any).navigation;
      if (nav && nav.currentEntry) {
        isBackForward = _lastNavigationType === "traverse";
      }
    } catch {
      // ignore — API not available
    }

    if (!isBackForward) {
      try {
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

    if (isBackForward) {
      // Restore saved scroll position for the route we are returning to.
      const saved = getSavedScroll(location);
      if (saved !== null && saved > 0) {
        // Use multiple attempts with increasing delays to handle async content rendering
        const attempts = [0, 50, 150, 300];
        attempts.forEach((delay) => {
          if (delay === 0) {
            requestAnimationFrame(() => {
              window.scrollTo({ top: saved, left: 0, behavior: "instant" });
            });
          } else {
            setTimeout(() => {
              window.scrollTo({ top: saved, left: 0, behavior: "instant" });
            }, delay);
          }
        });
      }
    } else {
      // Forward navigation — scroll to top instantly.
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location]);

  // Also save scroll on page unload (tab close / hard navigation).
  useEffect(() => {
    const onBeforeUnload = () => {
      if (prevLocationRef.current) {
        saveScroll(prevLocationRef.current);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
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


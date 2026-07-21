import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * useScrollRestoration — saves scroll position per route and restores it on
 * back/forward navigation. For forward (push) navigations the page scrolls to top.
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
  const prevLocationRef = useRef<string | null>(null);

  // 1. Continuously save scroll position for the current location
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const handleScroll = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveScroll(location);
      }, 50); // Debounce to avoid excessive writes
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    // Save immediately on mount in case they navigate away before scrolling
    saveScroll(location);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeout) clearTimeout(timeout);
    };
  }, [location]);

  // 2. Handle restoration on location change
  useEffect(() => {
    if (prevLocationRef.current === null) {
      prevLocationRef.current = location;
      return;
    }

    if (prevLocationRef.current === location) {
      return;
    }

    // Force one last save before we process the change
    saveScroll(prevLocationRef.current);
    prevLocationRef.current = location;

    // Detect back / forward traversal
    let isBackForward = false;

    try {
      const nav = (window as any).navigation;
      if (nav && nav.currentEntry) {
        isBackForward = _lastNavigationType === "traverse";
      }
    } catch {
      // API not available
    }

    if (!isBackForward) {
      try {
        const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
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
        // Extended delays added because Home Page has images/banners that take time to expand
        const attempts = [0, 50, 150, 300, 500, 800, 1200];
        
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
}

// ── Navigation API event listener (module-level, set up once) ────────────────
let _lastNavigationType: string = "push";

try {
  const nav = (window as any).navigation;
  if (nav) {
    nav.addEventListener("navigate", (event: any) => {
      _lastNavigationType = event.navigationType ?? "push";
      
      // Attempt to save synchronously right as navigation starts
      try {
        const currentPath = new URL(nav.currentEntry?.url || window.location.href).pathname;
        saveScroll(currentPath);
      } catch {}
    });
  }
} catch {
  // Navigation API not available
}


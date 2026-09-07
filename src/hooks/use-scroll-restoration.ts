import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const SCROLL_KEY_PREFIX = "embr_scroll_";

type NavigationKind = "push" | "replace" | "pop";

let lastNavigationKind: NavigationKind = "push";
let historyPatched = false;
let isRestoring = false;
let restoreTimeout: ReturnType<typeof setTimeout> | undefined;

// In-memory cache for instant synchronous access
const scrollMap = new Map<string, number>();

function getScrollKey() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

function saveScroll(path: string, y?: number) {
  if (typeof window === "undefined" || !path) return;
  const scrollY = typeof y === "number" ? y : window.scrollY;
  scrollMap.set(path, scrollY);
  try {
    sessionStorage.setItem(SCROLL_KEY_PREFIX + path, String(scrollY));
  } catch {}
}

function getSavedScroll(path: string): number | null {
  if (typeof window === "undefined" || !path) return null;
  if (scrollMap.has(path)) {
    return scrollMap.get(path)!;
  }
  try {
    const value = sessionStorage.getItem(SCROLL_KEY_PREFIX + path);
    if (value !== null) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        scrollMap.set(path, num);
        return num;
      }
    }
  } catch {}
  return null;
}

let activePath = typeof window !== "undefined" ? getScrollKey() : "/";

function patchHistoryForScroll() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(...args) {
    saveScroll(activePath, window.scrollY);
    lastNavigationKind = "push";
    const res = originalPushState.apply(this, args);
    activePath = getScrollKey();
    return res;
  };

  window.history.replaceState = function replaceState(...args) {
    saveScroll(activePath, window.scrollY);
    lastNavigationKind = "replace";
    const res = originalReplaceState.apply(this, args);
    activePath = getScrollKey();
    return res;
  };

  window.addEventListener(
    "popstate",
    () => {
      lastNavigationKind = "pop";
      activePath = getScrollKey();
    },
    { capture: true }
  );

  const stopRestoring = () => {
    if (isRestoring) {
      isRestoring = false;
      if (restoreTimeout) clearTimeout(restoreTimeout);
    }
  };
  window.addEventListener("wheel", stopRestoring, { passive: true });
  window.addEventListener("touchstart", stopRestoring, { passive: true });
  window.addEventListener("touchmove", stopRestoring, { passive: true });
  window.addEventListener("keydown", stopRestoring, { passive: true });
}

if (typeof window !== "undefined") {
  patchHistoryForScroll();
}

function performScrollRestoration(targetY: number) {
  if (targetY <= 0) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return;
  }

  isRestoring = true;
  if (restoreTimeout) clearTimeout(restoreTimeout);

  const attempt = () => {
    if (!isRestoring) return;
    window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    if (Math.abs(window.scrollY - targetY) <= 5) {
      isRestoring = false;
    }
  };

  attempt();

  const delays = [20, 50, 100, 200, 350, 500, 800, 1200];
  delays.forEach((delay) => {
    window.setTimeout(() => {
      if (isRestoring) attempt();
    }, delay);
  });

  restoreTimeout = window.setTimeout(() => {
    isRestoring = false;
  }, 1500);
}

export function useScrollRestoration() {
  const [location] = useLocation();
  const previousLocationRef = useRef<string | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const handleScroll = () => {
      if (isRestoring) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!isRestoring) {
          saveScroll(getScrollKey(), window.scrollY);
        }
      }, 100);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && !isRestoring) {
        saveScroll(getScrollKey(), window.scrollY);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const currentPath = getScrollKey();
    const prevPath = previousLocationRef.current;

    if (prevPath === null) {
      previousLocationRef.current = currentPath;
      activePath = currentPath;
      const saved = getSavedScroll(currentPath);
      if (saved !== null && saved > 0) {
        performScrollRestoration(saved);
      }
      return;
    }

    if (prevPath === currentPath) return;

    previousLocationRef.current = currentPath;
    activePath = currentPath;

    if (lastNavigationKind === "pop") {
      const saved = getSavedScroll(currentPath);
      if (saved !== null && saved > 0) {
        performScrollRestoration(saved);
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
}


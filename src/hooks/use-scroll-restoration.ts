import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const SCROLL_KEY_PREFIX = "embr_scroll_";
const RESTORE_DELAYS = [0, 50, 150, 300, 600, 1000];

type NavigationKind = "push" | "replace" | "pop";

let lastNavigationKind: NavigationKind = "push";
let historyPatched = false;
let activeScrollKey = "";

function getScrollKey() {
  return `${window.location.pathname}${window.location.search}`;
}

function saveScroll(path: string) {
  try {
    sessionStorage.setItem(SCROLL_KEY_PREFIX + path, String(window.scrollY));
  } catch {}
}

function getSavedScroll(path: string): number | null {
  try {
    const value = sessionStorage.getItem(SCROLL_KEY_PREFIX + path);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

function restoreScroll(path: string) {
  const saved = getSavedScroll(path);
  if (saved === null || Number.isNaN(saved)) return;

  RESTORE_DELAYS.forEach((delay) => {
    const restore = () => window.scrollTo({ top: saved, left: 0, behavior: "auto" });

    if (delay === 0) {
      requestAnimationFrame(restore);
    } else {
      window.setTimeout(restore, delay);
    }
  });
}

function saveActiveScroll() {
  saveScroll(activeScrollKey || getScrollKey());
}

function patchHistoryForScroll() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  activeScrollKey = getScrollKey();

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function pushState(...args) {
    saveActiveScroll();
    lastNavigationKind = "push";
    return originalPushState.apply(this, args);
  };

  window.history.replaceState = function replaceState(...args) {
    saveActiveScroll();
    lastNavigationKind = "replace";
    return originalReplaceState.apply(this, args);
  };

  window.addEventListener("popstate", () => {
    saveActiveScroll();
    lastNavigationKind = "pop";
  });
}

export function useScrollRestoration() {
  const [location] = useLocation();
  const previousKeyRef = useRef<string | null>(null);

  useEffect(() => {
    patchHistoryForScroll();
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const persist = () => saveScroll(getScrollKey());
    const handleScroll = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(persist, 80);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    persist();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeout) clearTimeout(timeout);
      persist();
    };
  }, [location]);

  useEffect(() => {
    const currentKey = getScrollKey();
    const previousKey = previousKeyRef.current;

    if (previousKey === null) {
      previousKeyRef.current = currentKey;
      activeScrollKey = currentKey;
      restoreScroll(currentKey);
      return;
    }

    if (previousKey === currentKey) return;

    saveScroll(previousKey);
    previousKeyRef.current = currentKey;
    activeScrollKey = currentKey;

    if (lastNavigationKind === "pop") {
      restoreScroll(currentKey);
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
}

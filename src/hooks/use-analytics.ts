import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem("_embr_vid");
    if (!id) {
      id = generateUUID();
      localStorage.setItem("_embr_vid", id);
    }
    return id;
  } catch {
    return generateUUID();
  }
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("_embr_sid");
    if (!id) {
      id = generateUUID();
      sessionStorage.setItem("_embr_sid", id);
    }
    return id;
  } catch {
    return generateUUID();
  }
}

function isAdminPath(path: string): boolean {
  return path.startsWith("/admin");
}

let _lastTrackedPath = "";

async function trackPageView(page: string, isNewSession: boolean) {
  try {
    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const referrer = document.referrer || "";

    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ visitorId, sessionId, page, referrer, isNewSession }),
    });
  } catch {
    // silently fail — never break the site for analytics
  }
}

async function sendHeartbeat() {
  try {
    const sessionId = getSessionId();
    await fetch("/api/track/heartbeat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // silently fail
  }
}

/**
 * useAnalytics — tracks every page view and sends heartbeats.
 * Must be called from a component that lives at the top of the app
 * (e.g. inside App.tsx or a thin wrapper).
 */
export function useAnalytics() {
  const [location] = useLocation();
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isNewSessionRef = useRef(true);

  useEffect(() => {
    if (isAdminPath(location)) return;
    if (location === _lastTrackedPath) return;
    _lastTrackedPath = location;

    const isNew = isNewSessionRef.current;
    isNewSessionRef.current = false;
    trackPageView(location, isNew);
  }, [location]);

  // Heartbeat every 60 seconds to mark visitor as live
  useEffect(() => {
    heartbeatRef.current = setInterval(() => {
      if (!isAdminPath(window.location.pathname)) {
        sendHeartbeat();
      }
    }, 60_000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);
}

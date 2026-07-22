import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";

const SESSION_KEY = "hayc_platform_analytics_session";
const LOGIN_SENT_KEY = "hayc_platform_analytics_login_sent";
const HEARTBEAT_MS = 30_000;

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}

function sendEvents(
  events: Array<{
    eventType: "login" | "pageview" | "heartbeat";
    path: string;
    sessionId: string;
    durationMs?: number;
  }>,
  useBeacon = false,
) {
  if (events.length === 0) return;
  const body = JSON.stringify({ events });
  if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/platform-analytics/events", blob);
    return;
  }
  void fetch("/api/platform-analytics/events", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Tracks authenticated platform usage for admin product analytics.
 * Skips when logged out or while impersonating.
 */
export function PlatformAnalyticsTracker() {
  const { user, impersonation } = useAuth();
  const location = useLocation();
  const pathRef = useRef(location.pathname + location.search);
  const pathStartedAtRef = useRef(Date.now());
  const sessionIdRef = useRef(getOrCreateSessionId());
  const enabled = Boolean(user) && !impersonation?.active;

  // login once per browser-tab session
  useEffect(() => {
    if (!enabled) return;
    try {
      if (sessionStorage.getItem(LOGIN_SENT_KEY) === sessionIdRef.current) return;
      sessionStorage.setItem(LOGIN_SENT_KEY, sessionIdRef.current);
    } catch {
      // continue
    }
    sendEvents([
      {
        eventType: "login",
        path: location.pathname + location.search || "/",
        sessionId: sessionIdRef.current,
      },
    ]);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // pageview on route change + flush prior path duration
  useEffect(() => {
    if (!enabled) return;
    const nextPath = location.pathname + location.search || "/";
    const prevPath = pathRef.current;
    const elapsed = Date.now() - pathStartedAtRef.current;

    if (prevPath && prevPath !== nextPath && elapsed > 0) {
      sendEvents([
        {
          eventType: "heartbeat",
          path: prevPath,
          sessionId: sessionIdRef.current,
          durationMs: elapsed,
        },
      ]);
    }

    pathRef.current = nextPath;
    pathStartedAtRef.current = Date.now();
    sendEvents([
      {
        eventType: "pageview",
        path: nextPath,
        sessionId: sessionIdRef.current,
      },
    ]);
  }, [enabled, location.pathname, location.search]);

  // periodic heartbeat while visible
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const elapsed = Date.now() - pathStartedAtRef.current;
      if (elapsed < 1_000) return;
      pathStartedAtRef.current = Date.now();
      sendEvents([
        {
          eventType: "heartbeat",
          path: pathRef.current || "/",
          sessionId: sessionIdRef.current,
          durationMs: elapsed,
        },
      ]);
    };

    const interval = window.setInterval(tick, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        const elapsed = Date.now() - pathStartedAtRef.current;
        if (elapsed > 0) {
          sendEvents(
            [
              {
                eventType: "heartbeat",
                path: pathRef.current || "/",
                sessionId: sessionIdRef.current,
                durationMs: elapsed,
              },
            ],
            true,
          );
          pathStartedAtRef.current = Date.now();
        }
      } else {
        pathStartedAtRef.current = Date.now();
      }
    };

    const onPageHide = () => {
      const elapsed = Date.now() - pathStartedAtRef.current;
      if (elapsed > 0) {
        sendEvents(
          [
            {
              eventType: "heartbeat",
              path: pathRef.current || "/",
              sessionId: sessionIdRef.current,
              durationMs: elapsed,
            },
          ],
          true,
        );
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [enabled]);

  return null;
}

import type { NextFunction, Request, Response } from "express";

/** Paths demo users may still POST/PUT/PATCH/DELETE. */
const DEMO_WRITE_ALLOWLIST: Array<string | RegExp> = [
  "/api/logout",
  "/api/auth/session",
  "/api/demo/enter",
  "/api/platform-analytics/events",
  /^\/api\/demo\//,
];

function isAllowedDemoWrite(path: string): boolean {
  return DEMO_WRITE_ALLOWLIST.some((entry) =>
    typeof entry === "string" ? path === entry || path.startsWith(entry + "/") : entry.test(path),
  );
}

export function isDemoUser(user: Express.User | undefined | null): boolean {
  return Boolean(user && (user as { isDemo?: boolean }).isDemo);
}

/**
 * Blocks mutating API calls for demo portal users.
 * Safe for real customers: only applies when req.user.isDemo === true.
 */
export function demoReadOnlyMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  if (!req.isAuthenticated?.() || !isDemoUser(req.user)) {
    return next();
  }

  const path = req.path || req.originalUrl?.split("?")[0] || "";
  if (isAllowedDemoWrite(path)) {
    return next();
  }

  return res.status(403).json({
    error: "Demo is read-only. Sign up to make changes.",
    code: "DEMO_READONLY",
  });
}

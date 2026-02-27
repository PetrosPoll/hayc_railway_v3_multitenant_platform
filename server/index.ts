// Load environment variables from .env file
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations } from "./migrate";
// Load environment variables from .env file
import "dotenv/config";

const app = express();
// Skip JSON/urlencoded parsing for webhook endpoint - it needs raw body for Stripe signature verification
// Use larger limit for email templates (base64 images can be large) and bulk-import endpoints
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/webhook')) {
    next();
  } else if ((req.originalUrl.startsWith('/api/email-templates') || req.originalUrl.startsWith('/api/admin/templates')) && (req.method === 'POST' || req.method === 'PATCH')) {
    // 50MB limit for email templates (to handle base64-encoded images)
    express.json({ limit: '50mb' })(req, res, next);
  } else if ((req.originalUrl.startsWith('/api/contacts/bulk-import') || req.originalUrl.startsWith('/api/admin/contacts/bulk-import')) && req.method === 'POST') {
    // 10MB limit for bulk-import endpoints (to handle large contact imports)
    express.json({ limit: '10mb' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/webhook')) {
    next();
  } else {
    express.urlencoded({ extended: false })(req, res, next);
  }
});

// Add header logging middleware for debugging
// app.use((req, res, next) => {
//   if (req.path.startsWith("/api")) {
//     console.log(`Request to ${req.path} with headers:`, {
//       acceptLanguage: req.headers['accept-language'],
//       contentType: req.headers['content-type']
//     });
//   }
//   next();
// });

// Add API request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Define health check endpoint FIRST - must respond immediately for DigitalOcean health checks
app.get("/health", (_req, res) => res.status(200).send("ok"));

(async () => {
  // Add API preflight handler for all /api routes before anything else
  app.use("/api/*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      res.set({
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      });
    }
    next();
  });

  // Register all routes (custom roles load is non-blocking so this returns quickly)
  const server = await registerRoutes(app);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite/static AFTER all API routes
  const isProd = process.env.NODE_ENV === "production";

  console.log("ENV CHECK:", {
    nodeEnv: process.env.NODE_ENV,
    expressEnv: app.get("env"),
  });

  if (!isProd) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 5000;

  // Start listening immediately so DigitalOcean health checks pass (defer migrations until after)
  server.listen(port, "0.0.0.0", () => {
    console.log(`serving on ${port}`);
    // Run migrations after server is listening (production + staging; skip in development)
    if (isProd) {
      runMigrations().catch((err) => console.error("Migration failed:", err));
    }
  });
})();
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse, (key, value) => {
            if (typeof value === 'bigint') {
              return value.toString();
            }
            if (value instanceof Date) {
              return value.toISOString();
            }
            return value;
          })}`;
        } catch (error) {
          logLine += ` :: [Response not serializable: ${error instanceof Error ? error.message : String(error)}]`;
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("[ERROR]", status, message, err?.stack);
    res.status(status).json({ message });
  });

  // Add middleware to log all requests for debugging deployment issues
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[REQUEST] ${timestamp} - ${req.method} ${req.url} from ${req.ip || 'unknown'}`);
    
    // Log specific details for root and health checks
    if (req.url === '/' || req.url === '/health' || req.url === '/api/health') {
      console.log(`[DEPLOYMENT-DEBUG] ${timestamp} - Critical endpoint accessed: ${req.url}`);
      console.log(`[DEPLOYMENT-DEBUG] User-Agent: ${req.get('User-Agent') || 'unknown'}`);
      console.log(`[DEPLOYMENT-DEBUG] Environment: ${process.env.NODE_ENV || 'development'}`);
    }
    
    next();
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (
    process.env.NODE_ENV === "development" ||
    app.get("env") === "development"
  ) {
    console.log(`[SETUP] Using Vite development server`);
    await setupVite(app, server);
  } else {
    console.log(`[SETUP] Using static file serving for production`);
    serveStatic(app);
    
    // CRITICAL: Add SPA fallback for production - serve index.html for non-API routes
    app.use("*", (req, res) => {
      // Don't interfere with API routes
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ message: "API endpoint not found" });
      }
      
      const timestamp = new Date().toISOString();
      console.log(`[SPA-FALLBACK] ${timestamp} - Serving SPA for route: ${req.originalUrl} from ${req.ip}`);
      
      const distPath = path.resolve(import.meta.dirname, "public");
      res.sendFile(path.resolve(distPath, "index.html"), (err) => {
        if (err) {
          console.error(`[SPA-ERROR] ${timestamp} - Failed to serve index.html:`, err.message);
          res.status(500).send("Internal Server Error");
        }
      });
    });
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  
  // Enhanced logging for deployment debugging
  log(`Starting server configuration:`);
  log(`  - Port: ${port}`);
  log(`  - Host: 0.0.0.0`);
  log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`  - Process ID: ${process.pid}`);
  log(`  - Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`✓ Server successfully started and listening on port ${port}`);
      log(`✓ Health check available at: http://0.0.0.0:${port}/health`);
      log(`✓ API health check available at: http://0.0.0.0:${port}/api/health`);
      log(`✓ Server is ready to accept connections`);
    },
  );

  // Handle server startup errors
  server.on('error', (error: any) => {
    console.error(`[ERROR] Server failed to start:`, error);
    if (error.code === 'EADDRINUSE') {
      console.error(`[ERROR] Port ${port} is already in use`);
    }
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
      log('Server closed successfully');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down gracefully');
    server.close(() => {
      log('Server closed successfully');
      process.exit(0);
    });
  });
})();

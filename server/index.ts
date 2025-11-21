import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { mqttService } from "./mqtt-service";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- blindaje de proceso ---
process.on("unhandledRejection", (err: any) => {
  console.error("[unhandledRejection]", err?.message, err?.stack);
});
process.on("uncaughtException", (err: any) => {
  console.error("[uncaughtException]", err?.message, err?.stack);
});

// --- logger /api seguro (no peta con BigInt) ---
function safeSerialize(obj: unknown): string | null {
  try {
    return JSON.stringify(obj, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
  } catch {
    return null;
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown;

  const originalResJson = res.json.bind(res);
  res.json = (body: any, ...args: any[]) => {
    capturedJsonResponse = body;
    return originalResJson(body, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;

    // Log todas las rutas que no sean archivos estáticos comunes
    if (!path.match(/\.(js|css|ico|png|jpg|svg|woff|woff2)$/)) {
      let line = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (path.startsWith("/api") && capturedJsonResponse !== undefined) {
        const s = safeSerialize(capturedJsonResponse) ?? "[unserializable-json]";
        const snippet = s.length > 300 ? s.slice(0, 299) + "…" : s;
        line += ` :: ${snippet}`;
      } else if (!path.startsWith("/api")) {
        line += ` [SPA-ROUTE]`;
      }

      if (line.length > 1000) line = line.slice(0, 999) + "…";
      log(line);
    }
  });

  next();
});


(async () => {
  const server = await registerRoutes(app);

  // manejador de errores (no relanzar)
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    console.error(`[ERROR] ${req.method} ${req.path} - Status: ${status}, Message: ${message}`);
    console.error(`[ERROR-STACK]`, err?.stack);
    if (!res.headersSent) res.status(status).json({ message });
  });

  const isDev = process.env.NODE_ENV === "development" || app.get("env") === "development";
  console.log(`[STARTUP] Environment: ${process.env.NODE_ENV || 'undefined'}`);
  console.log(`[STARTUP] App environment: ${app.get("env")}`);
  console.log(`[STARTUP] Is development: ${isDev}`);

  if (isDev) {
    console.log(`[STARTUP] Using Vite development server`);
    await setupVite(app, server);
  } else {
    console.log(`[STARTUP] Using static file server for production`);
    serveStatic(app);
  }

  // Initialize MQTT service
  try {
    console.log("[STARTUP] Initializing MQTT Service...");
    await mqttService.initialize();
    console.log("[STARTUP] MQTT Service initialized successfully");
  } catch (error) {
    console.error("[STARTUP] Failed to initialize MQTT Service:", error);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port} in ${isDev ? 'development' : 'production'} mode`);
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    log("SIGTERM signal received: closing HTTP server");
    await mqttService.shutdown();
    server.close(() => {
      log("HTTP server closed");
    });
  });

  process.on("SIGINT", async () => {
    log("SIGINT signal received: closing HTTP server");
    await mqttService.shutdown();
    server.close(() => {
      log("HTTP server closed");
      process.exit(0);
    });
  });
})();